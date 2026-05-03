"""
scraper_weworkremotely.py — We Work Remotely job scraper
=========================================================
Architecture : HTML statique — données directement dans le DOM.

URL search    : https://weworkremotely.com/remote-jobs/search?term={query}
URL catégorie : https://weworkremotely.com/categories/remote-{slug}-jobs
URL detail    : https://weworkremotely.com/remote-jobs/{slug}

FIX 403 : curl_cffi impersonne le TLS fingerprint de Chrome → bypass détection bot.
           aiohttp est bloqué par WWR exactement comme Workopolis.

Stratégie double-source :
  1. Page de recherche  → jobs directs (preview limité)
  2. Bouton "View all N … jobs" → URL catégorie → listing complet
     Le bouton est détecté via <a> ou <button> contenant "View all" dans la page search.
     Les deux sources sont fusionnées (dedupe par URL).

Stop condition : si age_days >= MAX_AGE_DAYS (45) → break
  (listing trié du plus récent au plus ancien)

Dépendance : pip install curl_cffi
"""

import asyncio
import logging
import re
import urllib.parse
from datetime import datetime, timedelta

from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession

logger = logging.getLogger(__name__)

BASE_URL     = "https://weworkremotely.com"
SEARCH_URL   = f"{BASE_URL}/remote-jobs/search"
MAX_AGE_DAYS = 45

_HEADERS = {
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection":      "keep-alive",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_age_days(age_text: str) -> int:
    """
    "New" → 0 | "3d" → 3 | "17d" → 17 | "26d" → 26
    """
    t = (age_text or "").strip()
    if not t or t.lower() == "new":
        return 0
    if t.endswith("d"):
        try:
            return int(t[:-1])
        except ValueError:
            pass
    return 0


def _days_to_date(days: int) -> str:
    return (datetime.now() - timedelta(days=days)).date().isoformat()


async def _fetch_html(url: str, sess: AsyncSession) -> str:
    """GET avec curl_cffi (impersonne Chrome TLS fingerprint)."""
    try:
        resp = await sess.get(url, headers=_HEADERS, timeout=20)
        if resp.status_code != 200:
            logger.warning(f"[weworkremotely] HTTP {resp.status_code}: {url[:80]}")
            return ""
        return resp.text
    except asyncio.TimeoutError:
        logger.warning(f"[weworkremotely] timeout: {url[:80]}")
        return ""
    except Exception as e:
        logger.error(f"[weworkremotely] fetch error: {e}")
        return ""


def _extract_category_urls(soup: BeautifulSoup) -> list[str]:
    """
    Détecte tous les boutons / liens "View all N … jobs" dans la page de recherche
    et retourne leurs URLs absolues.

    WWR rend ce bouton sous plusieurs formes possibles :
      <a href="/categories/remote-full-stack-programming-jobs">View all 179 Full-Stack Programming jobs</a>
      <a class="view-all" href="/categories/...">View all …</a>
      <button ...>View all …</button>  ← parfois rendu en JS, non présent dans HTML statique

    On cherche tous les <a> dont le texte contient "View all" (case-insensitive)
    et dont le href pointe vers /categories/ ou /remote-jobs/.
    """
    category_urls = []
    seen = set()

    for tag in soup.find_all("a", href=True):
        text = tag.get_text(strip=True)
        href = tag["href"]

        # Filtre : texte "View all" + lien de type catégorie
        if re.search(r"view all", text, re.IGNORECASE):
            # Accepte /categories/... ou tout lien relatif / absolu WWR
            if href.startswith("/") or href.startswith(BASE_URL):
                full_url = f"{BASE_URL}{href}" if href.startswith("/") else href
                if full_url not in seen:
                    seen.add(full_url)
                    category_urls.append(full_url)
                    logger.info(
                        f"[weworkremotely] 🔗 bouton détecté → {full_url} "
                        f"('{text[:60]}')"
                    )

    if not category_urls:
        logger.info("[weworkremotely] aucun bouton 'View all' trouvé dans la page search")

    return category_urls


def _parse_job_items(job_items, seen_urls: set, source_label: str) -> tuple[list, bool]:
    """
    Parse une liste de <li.new-listing-container> et retourne :
      - results : liste de dicts job
      - stop    : True si on a atteint MAX_AGE_DAYS (signal d'arrêt)

    Mutates seen_urls pour la déduplication cross-sources.
    """
    results = []
    stop    = False

    for item in job_items:
        # ── Skip publicités ──────────────────────────────────────────────────
        item_id      = item.get("id", "")
        item_classes = " ".join(item.get("class", []))
        if "listing-ad" in item_id or "feature--ad" in item_classes:
            continue

        # ── URL ──────────────────────────────────────────────────────────────
        link = item.select_one("a.listing-link--unlocked") or \
               item.select_one("a[href^='/remote-jobs/']")
        if not link:
            continue
        href = link.get("href", "")
        if not href or href in seen_urls:
            continue
        seen_urls.add(href)
        job_url = f"{BASE_URL}{href}" if href.startswith("/") else href

        # ── Titre ────────────────────────────────────────────────────────────
        title_el = item.select_one(".new-listing__header__title__text")
        if not title_el:
            continue
        title = title_el.get_text(strip=True)
        if not title:
            continue

        # ── Entreprise ───────────────────────────────────────────────────────
        company_el = item.select_one(".new-listing__company-name")
        company    = company_el.get_text(strip=True) if company_el else ""
        company    = company.replace("Star Icon", "").replace("Top 100", "").strip()

        # ── Localisation ─────────────────────────────────────────────────────
        location_el = item.select_one(".new-listing__company-headquarters")
        location    = location_el.get_text(separator=" ", strip=True) if location_el else ""

        # ── Date / âge ───────────────────────────────────────────────────────
        date_el  = item.select_one("p.new-listing__header__icons__date")
        if date_el:
            span     = date_el.find("span")
            age_text = span.get_text(strip=True) if span else date_el.get_text(strip=True)
        else:
            age_text = "New"

        age_days = _parse_age_days(age_text)

        # ── STOP : job trop ancien ───────────────────────────────────────────
        if age_days >= MAX_AGE_DAYS:
            logger.info(
                f"[weworkremotely][{source_label}] STOP — '{title[:40]}' "
                f"est à {age_days}j >= {MAX_AGE_DAYS}j"
            )
            stop = True
            break

        # ── Catégories ───────────────────────────────────────────────────────
        cat_els    = item.select(".new-listing__categories__category")
        categories = [c.get_text(strip=True) for c in cat_els if c.get_text(strip=True)]

        remote = ""
        for cat in categories:
            if any(w in cat.lower() for w in ("anywhere", "worldwide", "remote")):
                remote = "Remote"
                break

        contract = ""
        for cat in categories:
            if cat in ("Full-Time", "Contract", "Part-Time", "Freelance"):
                contract = cat
                break

        # ── Salaire ──────────────────────────────────────────────────────────
        # Formats détectés dans le DOM :
        #   "$50,000 - $74,999 USD"  |  "$100,000 or more USD"  |  "$25,000 - $49,999 USD"
        salary = ""
        for cat in categories:
            c = cat.strip()
            if c.startswith("$") and ("USD" in c or "-" in c or "or more" in c.lower()):
                salary = c
                break

        results.append({
            "title":           title,
            "company":         company,
            "location":        location,
            "url":             job_url,
            "remote":          remote,
            "time_ago":        _days_to_date(age_days),
            "_wwr_contract":   contract,
            "_wwr_categories": ", ".join(categories),
            "_wwr_salary":     salary,
        })

    return results, stop


# ── API publique ──────────────────────────────────────────────────────────────

async def scrape_weworkremotely(cv_title: str, session) -> list:
    """
    Scrape le listing WWR pour cv_title via deux sources combinées :

    1. Page search  (/remote-jobs/search?term=…)
       → jobs directs + détection du bouton "View all N … jobs"

    2. Page catégorie  (/categories/remote-…-jobs)
       → listing complet de la catégorie (peut contenir 100+ offres)

    Les deux sources sont fusionnées par URL (dedupe).
    Arrêt dès qu'un job a age_days >= MAX_AGE_DAYS (45 jours).

    `session` (aiohttp du pipeline) ignoré — curl_cffi utilisé en interne.

    Champs retournés (standards pipeline) :
      title, company, location, url, remote, time_ago
      _wwr_contract    ← Full-Time / Contract / Part-Time
      _wwr_categories  ← toutes les catégories CSV
      _wwr_salary      ← ex: "$50,000 - $74,999 USD" | "$100,000 or more USD" | ""
    """
    query       = urllib.parse.quote(cv_title)
    search_url  = f"{SEARCH_URL}?term={query}"

    logger.info(f"[weworkremotely] search → {search_url}")

    async with AsyncSession(impersonate="chrome110") as sess:

        # ── ÉTAPE 1 : page de recherche ───────────────────────────────────────
        search_html = await _fetch_html(search_url, sess)
        if not search_html:
            logger.info("[weworkremotely] listing total: 0 jobs")
            return []

        search_soup = BeautifulSoup(search_html, "html.parser")
        search_items = search_soup.select("li.new-listing-container")
        logger.info(f"[weworkremotely][search] {len(search_items)} raw items")

        seen_urls = set()
        results   = []

        search_jobs, _ = _parse_job_items(search_items, seen_urls, "search")
        results.extend(search_jobs)
        logger.info(f"[weworkremotely][search] → {len(search_jobs)} jobs valides")

        # ── ÉTAPE 2 : bouton "View all" → pages catégories ───────────────────
        category_urls = _extract_category_urls(search_soup)

        for cat_url in category_urls:
            logger.info(f"[weworkremotely][category] fetch → {cat_url}")
            cat_html = await _fetch_html(cat_url, sess)
            if not cat_html:
                logger.warning(f"[weworkremotely][category] échec fetch {cat_url[:60]}")
                continue

            cat_soup  = BeautifulSoup(cat_html, "html.parser")
            cat_items = cat_soup.select("li.new-listing-container")
            logger.info(f"[weworkremotely][category] {len(cat_items)} raw items → {cat_url[:60]}")

            cat_jobs, _ = _parse_job_items(cat_items, seen_urls, "category")
            results.extend(cat_jobs)
            logger.info(
                f"[weworkremotely][category] → {len(cat_jobs)} nouveaux jobs "
                f"(total cumulé: {len(results)})"
            )

    logger.info(f"[weworkremotely] listing total: {len(results)} jobs")
    return results


async def fetch_weworkremotely_detail(job_url: str, session) -> str:
    """
    Fetch la description complète depuis la page détail.
    Utilisée par enrich() dans scraping_pipeline.py.
    `session` (aiohttp) ignoré — curl_cffi utilisé en interne.
    """
    try:
        async with AsyncSession(impersonate="chrome110") as sess:
            html = await _fetch_html(job_url, sess)
    except Exception as e:
        logger.error(f"[weworkremotely] detail fetch error: {e}")
        return ""
    if not html:
        return ""
    soup    = BeautifulSoup(html, "html.parser")
    desc_el = soup.select_one(".lis-container__job__content__description")
    if desc_el:
        return desc_el.get_text(separator="\n", strip=True)[:3000]
    main_el = soup.select_one(".lis-container__job__content")
    if main_el:
        return main_el.get_text(separator="\n", strip=True)[:3000]
    return ""