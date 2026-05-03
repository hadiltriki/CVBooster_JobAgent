"""
scraper_workopolis.py  —  Workopolis job scraper
================================================
Utilise curl_cffi pour impersonner Chrome au niveau TLS → bypass 403 Workopolis.
aiohttp est bloqué car Workopolis détecte le fingerprint TLS Python.

pip install curl_cffi

MODIFICATIONS :
  1. _is_too_old(date_str) — helper : retourne True si pub_date >= 45 jours
  2. Dans la boucle jobs : chaque job trop vieux est ignoré (skipped) + log
  3. Si TOUS les jobs d'une page sont trop vieux → stop_pagination=True → break pages
  4. Si la liste results est vide en fin de scraping → log warning explicite
"""

import asyncio
import json
import logging
import urllib.parse
from datetime import date, datetime

from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession

logger = logging.getLogger(__name__)

BASE_URL   = "https://www.workopolis.com"
SEARCH_URL = f"{BASE_URL}/search"
MAX_PAGES  = 3

# ── [MOD 1] Seuil d'âge maximum en jours ─────────────────────────────────────
MAX_AGE_DAYS = 45

_HEADERS = {
    "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language":           "en-CA,en;q=0.9",
    "Accept-Encoding":           "gzip, deflate, br",
    "Cache-Control":             "max-age=0",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest":            "document",
    "Sec-Fetch-Mode":            "navigate",
    "Sec-Fetch-Site":            "none",
    "Sec-Fetch-User":            "?1",
}

_SKIP_SKILLS = {
    "no university degree", "bachelor's", "master's degree", "bachelor",
    "english", "french", "bilingual", "spanish", "no experience needed",
    "high school diploma or ged", "in-person", "internship / co-op",
    "communication skills", "computer skills", "analysis skills",
    "writing skills", "presentation skills", "research", "sales",
    "travel", "cad", "windows", "business",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_next_data(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    script = soup.find("script", {"id": "__NEXT_DATA__"})
    if not script or not script.string:
        return {}
    try:
        return json.loads(script.string)
    except json.JSONDecodeError as e:
        logger.error(f"[workopolis] JSON parse error: {e}")
        return {}


def _ms_to_date(ts_ms: int) -> str:
    if not ts_ms or ts_ms <= 0:
        return datetime.now().date().isoformat()
    try:
        return datetime.fromtimestamp(ts_ms / 1000).date().isoformat()
    except Exception:
        return datetime.now().date().isoformat()


def _clean_skills(raw: list) -> str:
    seen, cleaned = set(), []
    for s in (raw or []):
        if not s:
            continue
        s = s.strip()
        if s.lower() in _SKIP_SKILLS or len(s) <= 1:
            continue
        key = s.lower()
        if key not in seen:
            seen.add(key)
            cleaned.append(s)
    return ", ".join(cleaned)


# ── [MOD 2] Helper âge ────────────────────────────────────────────────────────

def _is_too_old(date_str: str) -> bool:
    """
    Retourne True si la date de publication est >= MAX_AGE_DAYS jours avant aujourd'hui.
    date_str : ISO format 'YYYY-MM-DD' (produit par _ms_to_date).
    En cas de date invalide, on considère le job comme valide (False) par sécurité.
    """
    try:
        pub_date = date.fromisoformat(date_str)
        age_days = (date.today() - pub_date).days
        return age_days >= MAX_AGE_DAYS
    except Exception:
        # Date invalide → on garde le job, pas de blocage
        return False


async def _fetch_html(url: str, sess: AsyncSession) -> str:
    """GET avec curl_cffi (impersonne Chrome TLS fingerprint)."""
    try:
        resp = await sess.get(url, headers=_HEADERS, timeout=20)
        if resp.status_code != 200:
            logger.warning(f"[workopolis] HTTP {resp.status_code}: {url[:80]}")
            return ""
        return resp.text
    except asyncio.TimeoutError:
        logger.warning(f"[workopolis] timeout: {url[:80]}")
        return ""
    except Exception as e:
        logger.error(f"[workopolis] fetch error: {e}")
        return ""


# ── API publique ──────────────────────────────────────────────────────────────

async def scrape_workopolis(cv_title: str, session) -> list:
    """
    Retourne tous les jobs du listing (sans cosine filter, sans fetch détail).
    Le pipeline fait le cosine check via handle_job() puis appelle enrich().

    `session` (aiohttp) est ignoré — on utilise curl_cffi en interne.

    ARRÊT ANTICIPÉ :
      • Si la liste de jobs d'une page est vide → break
      • Si TOUS les jobs d'une page sont trop vieux (>= 45 j) → break (stop_pagination)
      • Un job trop vieux au milieu d'une page est simplement ignoré (skipped)
      • Si results est vide à la fin → warning explicite
    """
    query_encoded = urllib.parse.quote(cv_title)
    results, seen_keys, cursor = [], set(), None

    # curl_cffi impersonne Chrome 110 au niveau TLS → bypass détection bot Workopolis
    async with AsyncSession(impersonate="chrome110") as sess:

        # Warmup homepage → cookies session
        try:
            warmup = await sess.get(BASE_URL, headers=_HEADERS, timeout=15)
            logger.info(f"[workopolis] warmup HTTP {warmup.status_code}")
        except Exception as e:
            logger.warning(f"[workopolis] warmup failed: {e}")
        await asyncio.sleep(1.0)

        for page in range(1, MAX_PAGES + 1):
            if cursor:
                page_url = (
                    f"{SEARCH_URL}?q={query_encoded}"
                    f"&cursor={urllib.parse.quote(cursor)}"
                )
            else:
                page_url = f"{SEARCH_URL}?q={query_encoded}"

            logger.info(f"[workopolis] page {page} → {page_url}")
            html = await _fetch_html(page_url, sess)
            if not html:
                break

            data = _extract_next_data(html)
            if not data:
                logger.warning(f"[workopolis] pas de __NEXT_DATA__ page {page}")
                break

            page_props = data.get("props", {}).get("pageProps", {})
            jobs = page_props.get("jobs", [])

            # ── [MOD 3] Arrêt si liste de jobs vide ──────────────────────────
            if not jobs:
                logger.info(f"[workopolis] 0 jobs page {page} — liste vide, arrêt pagination")
                break

            logger.info(f"[workopolis] {len(jobs)} jobs page {page}")

            # ── [MOD 4] Filtre par âge + détection page entièrement trop vieille
            skipped_old = 0  # compteur de jobs trop vieux sur cette page

            for job in jobs:
                job_key = job.get("jobKey", "")
                if not job_key or job_key in seen_keys:
                    continue
                seen_keys.add(job_key)

                title = (job.get("title") or "").strip()
                if not title:
                    continue

                # Calcul de la date de publication avant de construire le dict
                pub_date_str = _ms_to_date(job.get("dateOnIndeed", 0))

                # ── [MOD 4a] Job trop vieux : skip individuel ─────────────────
                if _is_too_old(pub_date_str):
                    skipped_old += 1
                    logger.debug(
                        f"[workopolis] skip (trop vieux {pub_date_str}): {title[:50]}"
                    )
                    continue

                listing_skills = (
                    job.get("requirements", []) +
                    job.get("uncategorized", [])
                )

                results.append({
                    "title":           title,
                    "company":         job.get("company", ""),
                    "location":        job.get("location", ""),
                    "url":             f"{BASE_URL}/jobsearch/viewjob/{job_key}",
                    "remote":          "Remote" if job.get("remoteAttributes") else "",
                    "time_ago":        pub_date_str,
                    "_wp_job_key":     job_key,
                    "_wp_query":       query_encoded,
                    "_wp_skills":      _clean_skills(listing_skills),
                    "_wp_salary":      job.get("salaryInfo") or "Not specified",
                    "_wp_job_type":    ", ".join(job.get("jobTypes", [])),
                    "_wp_description": job.get("snippet", ""),
                    "_wp_benefits":    ", ".join(job.get("benefits", [])),
                })

            # ── [MOD 4b] Tous les jobs de la page sont trop vieux → stop ─────
            # On compte les jobs non-dupliqués et non-sans-titre de cette page
            # pour savoir si skipped_old représente TOUS les jobs valides.
            valid_on_page = sum(
                1 for j in jobs
                if j.get("jobKey") and (j.get("title") or "").strip()
            )
            if valid_on_page > 0 and skipped_old >= valid_on_page:
                logger.info(
                    f"[workopolis] page {page} : tous les {skipped_old} jobs >= {MAX_AGE_DAYS} jours "
                    f"— arrêt pagination anticipé"
                )
                break

            # Pagination
            next_key = str(page + 1)
            cursors  = page_props.get("pageCursors", {})
            if next_key in cursors:
                cursor = cursors[next_key]
                await asyncio.sleep(0.6)
            else:
                break

    # ── [MOD 5] Log explicite si aucun résultat ───────────────────────────────
    if not results:
        logger.warning(
            f"[workopolis] aucun job retourné pour '{cv_title}' "
            f"(tous trop vieux, liste vide, ou erreur réseau)"
        )
    else:
        logger.info(f"[workopolis] listing total: {len(results)} jobs")

    return results


async def fetch_workopolis_detail(job_key: str, query_encoded: str, session) -> dict:
    """
    Fetch viewJobData pour un jobKey.
    Utilisée par enrich() dans scraping_pipeline.py.
    `session` (aiohttp) ignoré — curl_cffi utilisé en interne.
    """
    url = f"{SEARCH_URL}?q={query_encoded}&job={job_key}"
    try:
        async with AsyncSession(impersonate="chrome110") as sess:
            try:
                await sess.get(BASE_URL, headers=_HEADERS, timeout=15)
            except Exception:
                pass
            await asyncio.sleep(0.8)
            html = await _fetch_html(url, sess)
    except Exception as e:
        logger.error(f"[workopolis] detail fetch error: {e}")
        return {}
    if not html:
        return {}
    data = _extract_next_data(html)
    vd = data.get("props", {}).get("pageProps", {}).get("viewJobData", {})
    return vd if isinstance(vd, dict) else {}  # ← FIX : garantit toujours un dict


def parse_workopolis_detail(job: dict, vd: dict) -> dict:
    """
    Convertit viewJobData en dict details compatible pipeline.
    vd peut être None (fetch échoué) ou {} → on normalise à {} pour éviter AttributeError.
    """
    vd = vd or {}   # ← FIX : protège contre None retourné par fetch_workopolis_detail
    job = job or {}
    description = job.get("_wp_description", "")
    if vd.get("jobDescriptionHtml"):
        soup = BeautifulSoup(vd["jobDescriptionHtml"], "html.parser")
        description = soup.get_text(separator="\n", strip=True)[:3000]

    skills = job.get("_wp_skills", "")
    if vd.get("qualifications"):
        rich = _clean_skills(vd["qualifications"])
        if rich:
            skills = rich

    job_type = job.get("_wp_job_type", "")
    if vd.get("jobTypes"):
        job_type = ", ".join(vd["jobTypes"])

    location = job.get("location", "")
    if vd.get("formattedLocation"):
        location = vd["formattedLocation"]

    salary = job.get("_wp_salary", "Not specified")
    if vd.get("compensation"):
        salary = str(vd["compensation"])

    return {
        "title":       job.get("title", ""),
        "industry":    job.get("company", ""),
        "location":    location,
        "remote":      job.get("remote", ""),
        "salary":      salary,
        "contract":    job_type,
        "experience":  "",
        "education":   "",
        "pub_date":    job.get("time_ago", ""),
        "expired":     "",
        "description": description,
        "skills_req":  skills,
        "skills_bon":  "",
        "all_skills":  skills,
        "tags":        skills,
    }