"""
scraper_datajobs.py  —  DataJobs.com job scraper
=================================================
Site : https://datajobs.com
Technologie : HTML statique, rendu server-side, AUCUNE API/XHR.
Parser : curl_cffi (impersonate Chrome110) + BeautifulSoup.
          datajobs retourne HTTP 200 + body 'Host not in allowlist' avec aiohttp
          → curl_cffi bypass cette détection TLS fingerprint.

Stratégie :
  • Les pages de listing sont des pages HTML statiques paginées :
      https://datajobs.com/Data-Science-Jobs
      https://datajobs.com/Data-Science-Jobs/2
      https://datajobs.com/Data-Engineering-Jobs
      https://datajobs.com/Data-Engineering-Jobs/2  ...
  • Chaque job card contient : titre, company, location, salary (optionnel), url
  • L'url du job suit le pattern : /Company/Title-Job~{ID}
  • datajobs.com NE publie PAS la date dans le HTML listing.
    → Stratégie de datation : on fetch la page detail de chaque job pour
      extraire la date depuis la meta ou le texte, OU on utilise l'ID comme
      proxy d'âge (ID décroissant = plus récent).
    → DÉCISION FINALE : fetch detail systématique (nécessaire pour description
      et skills de toute façon) + extraction date depuis le texte HTML.
      Si pas de date trouvée → on accepte le job (safe default).

ARRÊT ANTICIPÉ (compatible pipeline) :
  • Si la page de listing est vide → stop cette source
  • Si le job fetché a une date >= MAX_AGE_DAYS → skip individuel + log
  • Si TOUS les jobs d'une page listing sont trop vieux → break pagination
  • Si results vide à la fin → warning explicite

Affichage instantané dans le dashboard :
  • Le scraper est un ASYNC GENERATOR (yield job par job)
  • Compatible avec le mode `hasattr(gen, '__aiter__')` de run_source()
  • Chaque job est yielded AVANT enrich → SSE "job_found" immédiat dans pipeline

pip install curl_cffi beautifulsoup4 lxml
"""

import asyncio
import logging
import re
from datetime import date, datetime

from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession as CurlSession

logger = logging.getLogger(__name__)

# ── Constantes ────────────────────────────────────────────────────────────────
BASE_URL      = "https://datajobs.com"
MAX_PAGES     = 5          # pages de listing par catégorie
MAX_AGE_DAYS  = 45         # arrêt si job publié il y a >= 45 jours
REQUEST_DELAY = 0.8        # délai poli entre requêtes (secondes)
FETCH_TIMEOUT = 20         # timeout HTTP (secondes)

# Catégories à scraper — URLs de listing datajobs.com
LISTING_URLS = [
    f"{BASE_URL}/Data-Science-Jobs",
    f"{BASE_URL}/Data-Engineering-Jobs",
    f"{BASE_URL}/Machine-Learning-Jobs",
    f"{BASE_URL}/Analytics-Jobs",
    f"{BASE_URL}/Data-Engineer-Jobs",
    f"{BASE_URL}/Data-Scientist-Jobs",
]

_HEADERS = {
    "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language":           "en-US,en;q=0.9",
    "Accept-Encoding":           "gzip, deflate, br",
    "Cache-Control":             "max-age=0",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest":            "document",
    "Sec-Fetch-Mode":            "navigate",
    "Sec-Fetch-Site":            "none",
    "Sec-Fetch-User":            "?1",
}

# Body invalide retourné par datajobs quand il détecte un non-browser
_INVALID_BODIES = {"host not in allowlist", "access denied", "forbidden", "blocked"}

# Regex pour extraire l'ID numérique depuis l'URL d'un job
_JOB_ID_RE = re.compile(r'Job~(\d+)', re.IGNORECASE)

# Patterns de date dans le texte HTML de la page detail
_DATE_PATTERNS = [
    # "Posted: January 15, 2026"
    re.compile(
        r'(?:posted|date posted|posted on)[:\s]+(\w+ \d{1,2},?\s*\d{4})',
        re.IGNORECASE
    ),
    # "Jan 15, 2026" ou "January 15 2026"
    re.compile(
        r'\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s+\d{4})\b',
        re.IGNORECASE
    ),
    # "2026-01-15" ISO
    re.compile(r'\b(\d{4}-\d{2}-\d{2})\b'),
    # "01/15/2026"
    re.compile(r'\b(\d{2}/\d{2}/\d{4})\b'),
]

_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_date_str(raw: str) -> date | None:
    """
    Tente de parser une chaîne date en objet date Python.
    Supporte : ISO, MM/DD/YYYY, 'January 15, 2026', 'Jan 15 2026'.
    Retourne None si le parsing échoue.
    """
    raw = raw.strip().replace(",", "")
    # ISO
    try:
        return date.fromisoformat(raw)
    except ValueError:
        pass
    # MM/DD/YYYY
    try:
        m, d, y = raw.split("/")
        return date(int(y), int(m), int(d))
    except Exception:
        pass
    # "January 15 2026" / "Jan 15 2026"
    parts = raw.split()
    if len(parts) == 3:
        try:
            month_key = parts[0][:3].lower()
            month = _MONTH_MAP.get(month_key)
            if month:
                return date(int(parts[2]), month, int(parts[1]))
        except Exception:
            pass
    return None


def _extract_pub_date(html: str) -> str | None:
    """
    Cherche une date de publication dans le HTML de la page detail.
    Retourne une chaîne ISO 'YYYY-MM-DD' ou None si introuvable.
    """
    for pattern in _DATE_PATTERNS:
        m = pattern.search(html)
        if m:
            parsed = _parse_date_str(m.group(1))
            if parsed:
                return parsed.isoformat()
    return None


def _is_too_old(date_iso: str | None) -> bool:
    """
    Retourne True si la date est >= MAX_AGE_DAYS jours avant aujourd'hui.
    Si date_iso est None (introuvable) → retourne False (on garde le job).
    """
    if not date_iso:
        return False
    try:
        pub = date.fromisoformat(date_iso)
        return (date.today() - pub).days >= MAX_AGE_DAYS
    except Exception:
        return False


def _extract_job_id(url_path: str) -> str:
    """Extrait l'ID numérique depuis '/Company/Title-Job~123456'."""
    m = _JOB_ID_RE.search(url_path)
    return m.group(1) if m else ""


async def _fetch(url: str, curl_sess: CurlSession) -> str:
    """
    GET avec curl_cffi (impersonate Chrome110).
    Détecte aussi les body invalides (ex: 'Host not in allowlist') → retourne ''.
    """
    try:
        resp = await curl_sess.get(url, headers=_HEADERS, timeout=FETCH_TIMEOUT)
        if resp.status_code != 200:
            logger.warning(f"[datajobs] HTTP {resp.status_code}: {url[:80]}")
            return ""
        text = resp.text
        # Détection body invalide (datajobs bloque les non-browsers)
        if len(text) < 500 and text.strip().lower() in _INVALID_BODIES:
            logger.warning(f"[datajobs] body invalide '{text.strip()[:80]}': {url[:80]}")
            return ""
        return text
    except asyncio.TimeoutError:
        logger.warning(f"[datajobs] timeout: {url[:80]}")
        return ""
    except Exception as e:
        logger.error(f"[datajobs] fetch error ({url[:60]}): {e}")
        return ""


# ── Parser listing page ───────────────────────────────────────────────────────

def _has_dashed_border(style: str | None) -> bool:
    """
    Détecte le style 'border-bottom: #aaa dashed 1px' de manière robuste.
    Normalise les espaces pour résister aux variations CSS de datajobs.
    """
    if not style:
        return False
    normalized = re.sub(r'\s+', ' ', style).lower()
    return (
        "border-bottom" in normalized
        and "#aaa" in normalized
        and "dashed" in normalized
    )


def _parse_listing_page(html: str) -> list[dict]:
    """
    Parse une page de listing datajobs.com.
    Retourne une liste de dicts minimaux :
      {title, company, location, salary, url, job_id}

    Stratégie double :
      1. Sélecteur style (border-bottom dashed #aaa) — normalisé pour résister
         aux variations d'espaces CSS.
      2. Fallback : recherche directe par href contenant 'Job~{ID}' si le
         sélecteur style ne retourne rien (structure HTML changée).

    Structure HTML d'une card listing :
      <div style="...border-bottom:#aaa dashed 1px...">
        <div style="margin-left:13px; font-size:13px;">
          <a href="/Company/Title-Job~ID">
            <strong>Title</strong>
            <span>Company</span>
          </a>
        </div>
        <div style="margin-left:13px;">
          <em><span>Location</span> · $Salary</em>
        </div>
      </div>
    """
    soup = BeautifulSoup(html, "html.parser")

    # ── Stratégie 1 : sélecteur style normalisé ───────────────────────────────
    cards = soup.find_all("div", style=_has_dashed_border)

    if cards:
        logger.debug(f"[datajobs] sélecteur style → {len(cards)} cards")
        return _extract_jobs_from_cards(cards)

    # ── Stratégie 2 : fallback par pattern href Job~ID ────────────────────────
    logger.warning(
        f"[datajobs] sélecteur style = 0 cards — fallback href Job~ID. "
        f"HTML preview (500 chars): {html[:500]!r}"
    )
    links = soup.find_all("a", href=lambda h: h and _JOB_ID_RE.search(h))

    if not links:
        logger.warning("[datajobs] fallback aussi = 0 liens Job~ID trouvés")
        return []

    logger.info(f"[datajobs] fallback → {len(links)} liens Job~ID trouvés")

    jobs       = []
    seen_hrefs = set()

    for link in links:
        href = link.get("href", "")
        if href in seen_hrefs:
            continue
        seen_hrefs.add(href)

        job_id = _extract_job_id(href)
        if not job_id:
            continue

        strong = link.find("strong")
        title  = strong.get_text(strip=True) if strong else link.get_text(strip=True)
        if not title:
            continue

        span_co = link.find("span")
        company = span_co.get_text(strip=True) if span_co else ""

        # Remonter au div parent pour chercher le <em>
        parent   = link.find_parent("div") or link
        em       = parent.find("em") if parent else None
        location = ""
        salary   = ""
        if em:
            em_text = em.get_text(" ").strip()
            parts   = re.split(r'[·•]|\xa0\xa0', em_text)
            location = parts[0].strip() if parts else ""
            salary   = parts[1].strip() if len(parts) > 1 else ""

        full_url = BASE_URL + href if href.startswith("/") else href

        jobs.append({
            "title":    title,
            "company":  company,
            "location": location,
            "salary":   salary or "Not specified",
            "url":      full_url,
            "job_id":   job_id,
        })

    return jobs


def _extract_jobs_from_cards(cards) -> list[dict]:
    """
    Extrait les jobs depuis les cards trouvées par le sélecteur style.
    Utilisée par _parse_listing_page() stratégie 1.
    """
    jobs = []
    for card in cards:
        link = card.find("a", href=True)
        if not link:
            continue

        href   = link.get("href", "")
        job_id = _extract_job_id(href)
        if not job_id:
            continue

        # Titre
        strong = link.find("strong")
        title  = strong.get_text(strip=True) if strong else link.get_text(strip=True)
        if not title:
            continue

        # Company (span dans le lien)
        span_co = link.find("span")
        company = span_co.get_text(strip=True) if span_co else ""

        # Location + salary depuis le <em>
        em       = card.find("em")
        location = ""
        salary   = ""
        if em:
            em_text = em.get_text(" ").strip()
            parts   = re.split(r'[·•]|\xa0\xa0', em_text)
            location = parts[0].strip() if parts else ""
            salary   = parts[1].strip() if len(parts) > 1 else ""

        full_url = BASE_URL + href if href.startswith("/") else href

        jobs.append({
            "title":    title,
            "company":  company,
            "location": location,
            "salary":   salary or "Not specified",
            "url":      full_url,
            "job_id":   job_id,
        })

    return jobs


# ── Parser detail page ────────────────────────────────────────────────────────

def _parse_detail_page(html: str, base_job: dict) -> dict:
    """
    Parse la page detail d'un job datajobs.com.
    Retourne un dict enrichi compatible avec le pipeline.

    Champs extraits :
      - description (texte propre, max 3000 chars)
      - location (depuis 'Job Location' si meilleure que listing)
      - salary (depuis 'Additional Job Details')
      - contract (employment type)
      - pub_date (si trouvée dans le HTML)
      - skills_req, all_skills (extraits de la description)
    """
    soup = BeautifulSoup(html, "html.parser")

    # ── Description ───────────────────────────────────────────────────────────
    desc_div    = soup.find("div", id="job_description")
    description = ""
    if desc_div:
        cell = desc_div.find("div", style=lambda s: s and "line-height" in (s or ""))
        if cell:
            description = cell.get_text(separator="\n", strip=True)[:3000]
        else:
            description = desc_div.get_text(separator="\n", strip=True)[:3000]

    # ── Blocs "jobpost-table" (location, salary, contract) ────────────────────
    location = base_job.get("location", "")
    salary   = base_job.get("salary", "Not specified")
    contract = ""

    tables = soup.find_all("div", class_="jobpost-table")
    for tbl in tables:
        header_div = tbl.find("div", class_="jobpost-table-cell-1")
        value_div  = tbl.find("div", class_="jobpost-table-cell-2")
        if not header_div or not value_div:
            continue

        header_text = header_div.get_text(strip=True).lower()

        if "job location" in header_text:
            loc = value_div.get_text(strip=True)
            if loc:
                location = loc

        elif "additional job details" in header_text:
            detail_text = value_div.get_text(separator="\n", strip=True)
            # Employment Type
            if "employment type" in detail_text.lower():
                lines = detail_text.split("\n")
                for i, line in enumerate(lines):
                    if "employment type" in line.lower() and i + 1 < len(lines):
                        contract = lines[i + 1].strip()
                        break
            # Salary range
            if "salary range" in detail_text.lower():
                lines = detail_text.split("\n")
                for i, line in enumerate(lines):
                    if "salary range" in line.lower() and i + 1 < len(lines):
                        salary = lines[i + 1].strip()
                        break

    # ── Date de publication ───────────────────────────────────────────────────
    pub_date = _extract_pub_date(html) or ""

    # ── Skills basiques extraits de la description ────────────────────────────
    # (le pipeline enrichit avec LLM plus tard, on fait un pré-extract simple)
    _TECH_KEYWORDS = [
        "python", "r ", "sql", "spark", "hadoop", "tensorflow", "pytorch",
        "scikit-learn", "sklearn", "pandas", "numpy", "tableau", "power bi",
        "aws", "azure", "gcp", "docker", "kubernetes", "airflow", "dbt",
        "machine learning", "deep learning", "nlp", "computer vision",
        "statistics", "excel", "java", "scala", "kafka", "databricks",
    ]
    desc_lower   = description.lower()
    found_skills = [kw for kw in _TECH_KEYWORDS if kw in desc_lower]
    skills_str   = ", ".join(found_skills)

    # Détection remote
    remote = ""
    if "remote" in location.lower() or "remote" in description.lower()[:200]:
        remote = "Remote"

    return {
        "title":       base_job.get("title", ""),
        "industry":    base_job.get("company", ""),
        "location":    location,
        "remote":      remote,
        "salary":      salary,
        "contract":    contract,
        "experience":  "",
        "education":   "",
        "pub_date":    pub_date,
        "expired":     "",
        "description": description,
        "skills_req":  skills_str,
        "skills_bon":  "",
        "all_skills":  skills_str,
        "tags":        skills_str,
    }


# ── API publique (async generator) ────────────────────────────────────────────

async def scrape_datajobs(cv_title: str, session):
    """
    Async generator — yield chaque job dès qu'il est trouvé.
    Compatible avec le mode `hasattr(gen, '__aiter__')` de run_source()
    dans scraping_pipeline.py → affichage INSTANTANÉ dans le dashboard.

    Flux :
      1. Pour chaque URL de listing (DATA_SCIENCE, DATA_ENGINEERING…)
      2. Pour chaque page (1..MAX_PAGES)
      3. Parse les cards → job minimal  (sélecteur CSS + fallback href)
      4. Fetch detail → enrichir + extraire date
      5. Si trop vieux → skip (compteur page_old++)
      6. Si tous les jobs de la page sont trop vieux → stop cette catégorie
      7. yield job → pipeline fait cosine + enrich LLM + SSE + DB

    `session` (aiohttp.ClientSession passé par le pipeline) n'est pas utilisé
    directement — curl_cffi est obligatoire car datajobs bloque aiohttp via
    fingerprint TLS.
    """
    seen_ids:    set[str] = set()
    total_yielded: int    = 0

    # curl_cffi AsyncSession — indépendant du session aiohttp du pipeline
    async with CurlSession(impersonate="chrome110") as curl_sess:

        # ── Warmup homepage → cookies de session ─────────────────────────────
        try:
            warmup = await curl_sess.get(BASE_URL, headers=_HEADERS, timeout=15)
            logger.info(f"[datajobs] warmup HTTP {warmup.status_code}")
        except Exception as e:
            logger.warning(f"[datajobs] warmup failed: {e}")
        await asyncio.sleep(1.0)

        for listing_url in LISTING_URLS:
            category = listing_url.split("/")[-1]   # ex: "Data-Science-Jobs"
            logger.info(f"[datajobs] catégorie: {category}")

            for page_num in range(1, MAX_PAGES + 1):

                # ── URL de pagination ─────────────────────────────────────────
                page_url = listing_url if page_num == 1 else f"{listing_url}/{page_num}"

                logger.info(f"[datajobs] page {page_num} → {page_url}")
                html_listing = await _fetch(page_url, curl_sess)

                if not html_listing:
                    logger.warning(f"[datajobs] page vide ou erreur: {page_url}")
                    break

                # ── Parse listing (CSS + fallback href) ───────────────────────
                page_jobs = _parse_listing_page(html_listing)

                if not page_jobs:
                    logger.info(f"[datajobs] 0 jobs sur {page_url} — fin catégorie")
                    break

                logger.info(f"[datajobs] {len(page_jobs)} jobs parsés page {page_num}")

                # ── Traitement job par job ────────────────────────────────────
                page_old   = 0   # jobs trop vieux sur cette page
                page_valid = 0   # jobs avec ID unique et titre valide

                for job_minimal in page_jobs:
                    job_id = job_minimal["job_id"]

                    # Déduplique entre catégories
                    if job_id in seen_ids:
                        continue
                    seen_ids.add(job_id)
                    page_valid += 1

                    # ── Fetch detail ──────────────────────────────────────────
                    await asyncio.sleep(REQUEST_DELAY)
                    html_detail = await _fetch(job_minimal["url"], curl_sess)

                    if not html_detail:
                        logger.warning(f"[datajobs] detail vide: {job_minimal['url'][:60]}")
                        pub_date = ""
                    else:
                        pub_date = _extract_pub_date(html_detail) or ""

                    # ── Filtre âge ────────────────────────────────────────────
                    if pub_date and _is_too_old(pub_date):
                        page_old += 1
                        logger.debug(
                            f"[datajobs] skip (trop vieux {pub_date}): "
                            f"{job_minimal['title'][:50]}"
                        )
                        continue

                    # ── Enrichir avec le detail ───────────────────────────────
                    if html_detail:
                        details = _parse_detail_page(html_detail, job_minimal)
                    else:
                        # Fallback : infos listing seulement
                        details = {
                            "title":       job_minimal["title"],
                            "industry":    job_minimal["company"],
                            "location":    job_minimal["location"],
                            "remote":      "Remote" if "remote" in job_minimal["location"].lower() else "",
                            "salary":      job_minimal["salary"],
                            "contract":    "",
                            "experience":  "",
                            "education":   "",
                            "pub_date":    pub_date,
                            "expired":     "",
                            "description": "",
                            "skills_req":  "",
                            "skills_bon":  "",
                            "all_skills":  "",
                            "tags":        "",
                        }

                    # ── Construire le job dict compatible pipeline ─────────────
                    job_out = {
                        # Champs standards pipeline
                        "title":    job_minimal["title"],
                        "company":  job_minimal["company"],
                        "location": details.get("location") or job_minimal["location"],
                        "url":      job_minimal["url"],
                        "remote":   details.get("remote", ""),
                        "time_ago": pub_date or datetime.now().date().isoformat(),
                        # Champs detail préfixés _dj_ (lus dans enrich() du pipeline)
                        "_dj_job_id":      job_id,
                        "_dj_salary":      details.get("salary", "Not specified"),
                        "_dj_contract":    details.get("contract", ""),
                        "_dj_description": details.get("description", ""),
                        "_dj_skills":      details.get("skills_req", ""),
                        "_dj_pub_date":    pub_date,
                    }

                    total_yielded += 1
                    logger.info(
                        f"[datajobs] ✅ yield #{total_yielded}: "
                        f"{job_minimal['title'][:40]} | {job_minimal['company']}"
                    )

                    # ── YIELD IMMÉDIAT → dashboard notifié tout de suite ───────
                    yield job_out

                # ── Stop catégorie si toute la page est trop vieille ─────────
                if page_valid > 0 and page_old >= page_valid:
                    logger.info(
                        f"[datajobs] page {page_num} catégorie '{category}': "
                        f"tous les {page_old} jobs >= {MAX_AGE_DAYS} jours — "
                        f"arrêt pagination catégorie"
                    )
                    break

                await asyncio.sleep(0.4)  # pause entre pages

    # ── Log final ─────────────────────────────────────────────────────────────
    if total_yielded == 0:
        logger.warning(
            f"[datajobs] aucun job retourné pour '{cv_title}' "
            f"(tous trop vieux, pages vides, ou erreurs réseau)"
        )
    else:
        logger.info(f"[datajobs] total yielded: {total_yielded} jobs")


# ── Fonction d'enrich compatible pipeline ────────────────────────────────────

def parse_datajobs_detail(job: dict, detail_html: str) -> dict:
    """
    Utilisée par enrich() dans scraping_pipeline.py si tu veux re-fetcher
    la page detail plus tard (ex: pour LLM extraction).

    job        : dict job_out produit par scrape_datajobs()
    detail_html: HTML brut de la page detail (peut être vide → dict fallback)
    """
    detail_html = detail_html or ""
    job         = job or {}

    if not detail_html:
        return {
            "title":       job.get("title", ""),
            "industry":    job.get("company", ""),
            "location":    job.get("location", ""),
            "remote":      job.get("remote", ""),
            "salary":      job.get("_dj_salary", "Not specified"),
            "contract":    job.get("_dj_contract", ""),
            "experience":  "",
            "education":   "",
            "pub_date":    job.get("_dj_pub_date", ""),
            "expired":     "",
            "description": job.get("_dj_description", ""),
            "skills_req":  job.get("_dj_skills", ""),
            "skills_bon":  "",
            "all_skills":  job.get("_dj_skills", ""),
            "tags":        job.get("_dj_skills", ""),
        }

    base = {
        "title":    job.get("title", ""),
        "company":  job.get("company", ""),
        "location": job.get("location", ""),
        "salary":   job.get("_dj_salary", "Not specified"),
    }
    return _parse_detail_page(detail_html, base)