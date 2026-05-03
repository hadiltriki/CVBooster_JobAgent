"""
scraper_keejob.py — Scraper keejob.com (Tunisie)
=================================================
Deux niveaux d'extraction :

NIVEAU 1 — Page de liste (/offres-emploi/?keywords=X)
  → scrape_keejob()  : titre, URL, société (base), lieu, contrat, salaire,
                        date snippet, description courte
  → Utilisé pour le filtre cosine (rapide)

NIVEAU 2 — Page détail (/offres-emploi/ID/slug/)
  → _fetch_keejob_detail() : extraction complète via :
      1. JSON-LD <script type="application/ld+json">  ← source principale
         datePosted, company, location, salary structuré
      2. Sidebar "Détails de l'annonce"               ← fallback HTML
         contrat, expérience, éducation, mobilité (remote)
      3. <div class="prose">                           ← description complète

Structure HTML confirmée (page détail) :
  JSON-LD :
    "datePosted": "2026-04-29"
    "hiringOrganization": {"name": "Entreprise Anonyme"}
    "jobLocation": {"address": {"addressLocality": "Tunis"}}
    "baseSalary": {"value": {"minValue": 600, "maxValue": 900, "unitText": "MONTH"}}

  Sidebar :
    <h3>Date de publication</h3>  <p>29 avril 2026</p>
    <h3>Type de contrat</h3>      <span class="bg-blue-100"><i class="fa-briefcase">CDI</span>
    <h3>Lieu de travail</h3>      <p>Tunis, Tunisie</p>
    <h3>Expérience requise</h3>   <p>Aucune expérience</p>
    <h3>Niveau d'études</h3>      <p>Bac</p>
    <h3>Salaire proposé</h3>      <span class="bg-green-100">600 - 900 TND / Mois</span>
    <h3>Mobilité</h3>             <p>Locale</p>   ← remote = Non

  Entreprise (company card) :
    <h3 class="text-xl font-semibold">Entreprise Anonyme</h3>
    <p><span>Secteur:</span> commerce / vente / distribution</p>

  Description :
    <div class="prose dark:prose-invert max-w-none">...</div>

Exports :
    scrape_keejob(query, session)            → list[dict]   (pipeline scraping)
    _fetch_keejob_detail(url, session)       → dict | None  (pipeline enrich)
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timedelta
from urllib.parse import quote_plus

import aiohttp
from bs4 import BeautifulSoup, Tag

from scraper_utils import (
    MAX_AGE_DAYS,
    HTTP_TIMEOUT,
    _age_label,
    _too_old,
    _infer_remote,
    extract_tech_from_description,
    extract_skills_with_llm,
)

logger = logging.getLogger(__name__)

KEEJOB_BASE   = "https://www.keejob.com"
KEEJOB_SEARCH = "https://www.keejob.com/offres-emploi/"

DEFAULT_MAX_JOBS = 60
MAX_PAGES        = 5
DELAY_PAGES      = 1.5

KEEJOB_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer":         "https://www.google.fr/",
    "Connection":      "keep-alive",
    "Cache-Control":   "no-cache",
}


# ══════════════════════════════════════════════════════════════════════════════
#  Traduction titre CV → mots-clés keejob français
# ══════════════════════════════════════════════════════════════════════════════

_CV_TO_KEEJOB: dict[str, list[str]] = {
    "cybersecurity":           ["cybersécurité", "sécurité informatique"],
    "cyber security":          ["cybersécurité", "sécurité informatique"],
    "security analyst":        ["analyste sécurité", "cybersécurité"],
    "information security":    ["sécurité information", "cybersécurité"],
    "soc analyst":             ["analyste soc", "sécurité informatique"],
    "penetration":             ["test intrusion", "pentesting"],
    "network security":        ["sécurité réseau"],
    "data scientist":          ["data scientist", "data science"],
    "data analyst":            ["data analyst", "analyste données"],
    "data engineer":           ["data engineer", "ingénieur données"],
    "machine learning":        ["machine learning", "intelligence artificielle"],
    "artificial intelligence": ["intelligence artificielle", "ia"],
    "deep learning":           ["deep learning", "intelligence artificielle"],
    "mlops":                   ["mlops", "devops"],
    "software engineer":       ["développeur", "ingénieur logiciel"],
    "full stack":              ["développeur full stack", "fullstack"],
    "fullstack":               ["développeur full stack"],
    "frontend":                ["développeur frontend", "développeur web"],
    "backend":                 ["développeur backend"],
    "mobile":                  ["développeur mobile"],
    "ios":                     ["développeur ios", "swift"],
    "android":                 ["développeur android", "kotlin"],
    "web developer":           ["développeur web"],
    "react":                   ["développeur react", "reactjs"],
    "angular":                 ["développeur angular"],
    "python":                  ["développeur python", "python"],
    "java":                    ["développeur java", "java"],
    "php":                     ["développeur php"],
    "nodejs":                  ["développeur nodejs", "javascript"],
    "javascript":              ["développeur javascript", "développeur web"],
    "dotnet":                  ["développeur .net", "c#"],
    "devops":                  ["devops", "ingénieur devops"],
    "cloud":                   ["cloud", "architecte cloud"],
    "aws":                     ["aws", "cloud"],
    "azure":                   ["azure", "cloud"],
    "kubernetes":              ["kubernetes", "devops"],
    "docker":                  ["docker", "devops"],
    "project manager":         ["chef de projet"],
    "product manager":         ["product manager", "chef de produit"],
    "scrum master":            ["scrum master", "agile"],
    "architect":               ["architecte logiciel"],
    "qa":                      ["testeur", "qa"],
    "embedded":                ["systèmes embarqués"],
    "bi":                      ["business intelligence"],
    "sap":                     ["sap", "consultant sap"],
    "technicien":              ["technicien informatique"],
    "informatique":            ["informatique", "développeur"],
    "réseaux":                 ["réseaux", "réseau informatique"],
}

_FR_KEYWORDS = {
    "développeur", "ingénieur", "analyste", "chef", "directeur",
    "responsable", "technicien", "consultant", "architecte",
    "informatique", "réseau", "système", "data", "cloud", "sécurité",
    "logiciel", "web", "mobile", "java", "python", "php", "sql",
}


def _build_queries(cv_title: str) -> list[str]:
    """
    Traduit le titre CV en 1-3 requêtes keejob françaises.
 
    Stratégie :
      1. Correspondance multi-mots sur le mapping EN→FR
      2. Correspondance mot par mot
      3. Mots français déjà présents dans le titre
      4. Fallback : titre brut + "informatique" (garantit des résultats)
 
    Pour "Cybersecurity Analyst" :
      → ["analyste sécurité", "cybersécurité", "cybersecurity analyst"]
 
    Pour "Data Engineer" :
      → ["data engineer", "ingénieur données"]
 
    Pour "Développeur Python" (déjà en FR) :
      → ["développeur python"]
    """
    lower = cv_title.lower().strip()
    queries: list[str] = []
 
    # ── 1. Correspondance multi-mots (triée par longueur décroissante) ────────
    for en_term, fr_list in sorted(_CV_TO_KEEJOB.items(), key=lambda x: -len(x[0])):
        if en_term in lower:
            queries.extend(fr_list[:2])
            break
 
    # ── 2. Correspondance mot par mot ─────────────────────────────────────────
    if not queries:
        for word in re.findall(r'[a-z]+', lower):
            if word in _CV_TO_KEEJOB:
                queries.extend(_CV_TO_KEEJOB[word][:2])
                break
 
    # ── 3. Mots français déjà présents ────────────────────────────────────────
    if not queries:
        fr_words = [w for w in lower.split() if w in _FR_KEYWORDS]
        if fr_words:
            queries.append(" ".join(fr_words[:3]))
 
    # ── 4. Fallback absolu ────────────────────────────────────────────────────
    if not queries:
        # Utiliser le titre brut (keejob tolère l'anglais partiellement)
        queries.append(lower)
 
    # ── Toujours ajouter "informatique" si aucun résultat garanti ─────────────
    # "informatique" retourne toujours des résultats sur keejob
    # et le modèle multilingue gère bien le matching FR↔EN
    has_generic_fallback = any(
        kw in " ".join(queries) for kw in
        ("informatique", "développeur", "ingénieur", "système", "réseau")
    )
    if not has_generic_fallback and len(queries) < 3:
        queries.append("informatique")
 
    # ── Dédupliquer + limiter à 3 ─────────────────────────────────────────────
    seen: set[str] = set()
    result: list[str] = []
    for q in queries:
        q = q.strip()
        if q and q not in seen:
            seen.add(q)
            result.append(q)
 
    logger.info(f"[keejob] CV='{cv_title}' → requêtes={result[:3]}")
    return result[:3]
# ══════════════════════════════════════════════════════════════════════════════
#  Parsers de date
# ══════════════════════════════════════════════════════════════════════════════

_MONTHS_FR = {
    "janvier": 1, "fevrier": 2, "février": 2, "mars": 3,
    "avril": 4,   "mai": 5,     "juin": 6,    "juillet": 7,
    "aout": 8,    "août": 8,    "septembre": 9, "octobre": 10,
    "novembre": 11, "decembre": 12, "décembre": 12,
}


def _parse_date_fr(text: str) -> datetime | None:
    """Parse "22 avril 2026", "2026-04-29", "il y a 3 jours", etc."""
    if not text:
        return None
    raw = str(text).strip()
    low = raw.lower()
    now = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    if any(w in low for w in ("aujourd", "maintenant")):
        return now
    if "hier" in low:
        return now - timedelta(days=1)

    # "il y a N jours/semaines/mois"
    m = re.search(r"il\s+y\s+a\s+(\d+)\s+(jour|semaine|mois)", low)
    if m:
        n, unit = int(m.group(1)), m.group(2)
        if "jour"    in unit: return now - timedelta(days=n)
        if "semaine" in unit: return now - timedelta(weeks=n)
        if "mois"    in unit: return now - timedelta(days=n * 30)

    # ISO "YYYY-MM-DD" (depuis JSON-LD datePosted)
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', raw)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass

    # "22 avril 2026" (confirmé dans le HTML keejob)
    m = re.search(r'(\d{1,2})\s+([a-zéûôèàâîùü]+)\s+(\d{4})', low)
    if m:
        mon = _MONTHS_FR.get(m.group(2))
        if mon:
            try:
                return datetime(int(m.group(3)), mon, int(m.group(1)))
            except ValueError:
                pass

    # DD/MM/YYYY
    m = re.search(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})', raw)
    if m:
        try:
            return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass

    return None


def _clean(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def _icon_cls(tag: Tag) -> str:
    return " ".join(tag.get("class") or [])


# ══════════════════════════════════════════════════════════════════════════════
#  NIVEAU 2 : Fetch page détail + extraction complète
# ══════════════════════════════════════════════════════════════════════════════

def _parse_json_ld(soup: BeautifulSoup) -> dict:
    """
    Extrait le bloc JSON-LD JobPosting depuis la page détail keejob.

    Exemple trouvé dans le HTML :
      <script type="application/ld+json">
      {
        "title":        "Agent de télésurveillance",
        "datePosted":   "2026-04-29",
        "validThrough": "2026-05-29",
        "hiringOrganization": {"name": "Entreprise Anonyme", "url": "..."},
        "jobLocation":  {"name": "Tunis", "address": {"addressLocality": "Tunis"}},
        "baseSalary": {
          "@type": "MonetaryAmount", "currency": "TND",
          "value": {"minValue": 600, "maxValue": 900, "unitText": "MONTH"}
        }
      }
      </script>
    """
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, dict) and (
                data.get("@type") == "JobPosting"
                or "datePosted" in data
                or "hiringOrganization" in data
            ):
                return data
        except (json.JSONDecodeError, TypeError):
            continue
    return {}


def _get_sidebar_value(soup: BeautifulSoup, label: str) -> str:
    """
    Extrait la valeur d'un champ de la sidebar 'Détails de l'annonce'.

    Pattern HTML :
      <h3 class="text-sm font-medium text-gray-500 ...">Date de publication</h3>
      <p class="text-gray-800 ...">29 avril 2026</p>

    Pour contrat et salaire, la valeur est dans un <span> (pas un <p>).
    """
    for h3 in soup.find_all("h3"):
        if label.lower() in _clean(h3.get_text()).lower():
            # Chercher le prochain élément frère ou enfant du parent
            parent = h3.find_parent("div")
            if not parent:
                continue
            # Valeur dans <p> ou <span> coloré
            val_el = parent.find("p", class_=re.compile(r"text-gray-800"))
            if val_el:
                return _clean(val_el.get_text())
            # Valeur dans un span coloré (contrat, salaire)
            span_el = parent.find("span", class_=re.compile(r"rounded-full"))
            if span_el:
                # Retirer le texte de l'icône
                icon = span_el.find("i")
                icon_text = _clean(icon.get_text()) if icon else ""
                full_text = _clean(span_el.get_text())
                return full_text.replace(icon_text, "").strip()
    return ""


async def _fetch_keejob_detail(
    url:     str,
    session: aiohttp.ClientSession,
) -> dict | None:
    """
    Fetch la page détail d'une offre keejob et extrait tous les champs.

    Ordre de priorité :
      1. JSON-LD  → datePosted, company, location, salary (précis et structuré)
      2. HTML     → contrat, expérience, éducation, mobilité, description

    Retourne un dict compatible avec le format `details` du pipeline,
    ou None si la page n'a pas pu être fetchée.
    """
    logger.debug(f"  [keejob/detail] fetch → {url}")
    try:
        async with session.get(
            url,
            headers         = KEEJOB_HEADERS,
            timeout         = aiohttp.ClientTimeout(total=15),
            allow_redirects = True,
        ) as resp:
            if resp.status != 200:
                logger.warning(f"  [keejob/detail] HTTP {resp.status} → {url}")
                return None
            html = await resp.text(encoding="utf-8", errors="replace")
    except Exception as exc:
        logger.error(f"  [keejob/detail] fetch error: {exc}")
        return None

    soup = BeautifulSoup(html, "html.parser")

    # ── 1. JSON-LD (source principale) ───────────────────────────────────────
    jld = _parse_json_ld(soup)

    # ── Titre ─────────────────────────────────────────────────────────────────
    title = _clean(jld.get("title", ""))
    if not title:
        h1 = soup.find("h1")
        title = _clean(h1.get_text()) if h1 else ""

    # ── Société ───────────────────────────────────────────────────────────────
    # JSON-LD : hiringOrganization.name
    company = _clean((jld.get("hiringOrganization") or {}).get("name", ""))
    if not company or company.lower() == "entreprise anonyme":
        # Fallback HTML : <h3 class="text-xl font-semibold">Nom Société</h3>
        co_h3 = soup.find("h3", class_=re.compile(r"text-xl.*font-semibold"))
        if co_h3:
            company_candidate = _clean(co_h3.get_text())
            if company_candidate and company_candidate.lower() != "entreprise anonyme":
                company = company_candidate
    # Garder "Entreprise Anonyme" si c'est vraiment ce que keejob affiche
    if not company:
        company = _clean((jld.get("hiringOrganization") or {}).get("name", ""))

    # ── Localisation ──────────────────────────────────────────────────────────
    # JSON-LD : jobLocation.address.addressLocality + addressRegion
    jld_loc  = jld.get("jobLocation") or {}
    jld_addr = jld_loc.get("address") or {}
    locality = _clean(jld_addr.get("addressLocality", ""))
    region   = _clean(jld_addr.get("addressRegion", ""))
    location = ", ".join(filter(None, [locality, region])) or _clean(jld_loc.get("name", ""))
    if not location:
        # Fallback HTML sidebar "Lieu de travail"
        location = _get_sidebar_value(soup, "Lieu de travail")

    # ── Salaire ───────────────────────────────────────────────────────────────
    # JSON-LD : baseSalary.value.{minValue, maxValue, unitText} + currency
    salary = "Non spécifié"
    jld_sal  = jld.get("baseSalary") or {}
    jld_val  = jld_sal.get("value") or {}
    min_s    = jld_val.get("minValue")
    max_s    = jld_val.get("maxValue")
    currency = _clean(jld_sal.get("currency", "TND"))
    unit     = _clean(jld_val.get("unitText", "MONTH"))
    unit_fr  = {"MONTH": "/ Mois", "YEAR": "/ An", "HOUR": "/ Heure"}.get(unit, f"/ {unit}")
    if min_s and max_s:
        salary = f"{min_s} - {max_s} {currency} {unit_fr}"
    elif min_s:
        salary = f"{min_s} {currency} {unit_fr}"
    else:
        # Fallback HTML sidebar
        sal_raw = _get_sidebar_value(soup, "Salaire")
        if sal_raw:
            salary = sal_raw

    # ── Date de publication ───────────────────────────────────────────────────
    # JSON-LD : datePosted "2026-04-29" (ISO, fiable)
    pub_date_raw = _clean(jld.get("datePosted", ""))
    if not pub_date_raw:
        pub_date_raw = _get_sidebar_value(soup, "Date de publication")
    pub_dt   = _parse_date_fr(pub_date_raw)
    time_ago = _age_label(pub_dt)

    # ── Type de contrat ───────────────────────────────────────────────────────
    # Sidebar : <h3>Type de contrat</h3> <span class="bg-blue-100"><i fa-briefcase>CDI
    contract = _get_sidebar_value(soup, "Type de contrat")
    if not contract:
        # Cherche directement le span bg-blue-100 avec fa-briefcase
        for span in soup.find_all("span", class_=re.compile(r"bg-blue-100")):
            icon = span.find("i", class_=re.compile(r"fa-briefcase"))
            if icon:
                contract = _clean(span.get_text()).replace(
                    _clean(icon.get_text()), ""
                ).strip()
                break

    # ── Expérience ────────────────────────────────────────────────────────────
    # Sidebar : <h3>Expérience requise</h3> <p>Aucune expérience</p>
    experience = _get_sidebar_value(soup, "Expérience")

    # ── Niveau d'études ───────────────────────────────────────────────────────
    education = _get_sidebar_value(soup, "Niveau d'études")

    # ── Mobilité / Remote ─────────────────────────────────────────────────────
    # Sidebar : <h3>Mobilité</h3> <p>Locale</p>
    # "Locale"     → non remote
    # "Nationale"  → non remote
    # "Télétravail" / "À distance" → remote
    mobility = _get_sidebar_value(soup, "Mobilité").lower()
    if any(w in mobility for w in ("télétravail", "distance", "remote", "home")):
        remote = "Télétravail"
    elif "locale" in mobility or "nationale" in mobility or mobility:
        remote = "Non"
    else:
        # Détecter depuis la description
        remote = ""

    # ── Secteur (de la fiche entreprise) ─────────────────────────────────────
    industry = ""
    for p in soup.find_all("p"):
        if "secteur" in _clean(p.get_text()).lower():
            # <p><span>Secteur:</span> commerce / vente / distribution</p>
            span_in_p = p.find("span")
            if span_in_p:
                span_in_p.extract()
            industry = _clean(p.get_text())
            break

    # ── Description complète ──────────────────────────────────────────────────
    # <div class="prose dark:prose-invert max-w-none">
    description = ""
    prose_div = soup.find("div", class_=re.compile(r"prose"))
    if prose_div:
        description = _clean(prose_div.get_text(" "))[:3000]

    if not description:
        # Fallback : section "Description de l'annonce"
        for h2 in soup.find_all("h2"):
            if "description" in _clean(h2.get_text()).lower():
                parent = h2.find_parent("div", class_=re.compile(r"rounded-lg"))
                if parent:
                    description = _clean(parent.get_text(" "))[:3000]
                    break

    # ── Skills depuis la description (LLM pour texte narratif) ───────────────
        if description:
            from scraper_utils import extract_skills_with_llm
            skills = await extract_skills_with_llm(description, max_skills=15)
            if not skills:
                # Fallback regex si LLM retourne vide
                # ── Skills depuis la description via LLM ─────────────────────────────────
                skills = ""
                if description:
                    try:
                        import os
                        from openai import AsyncAzureOpenAI as _AzureOAI
                        _client = _AzureOAI(
                            azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", ""),
                            api_key        = os.getenv("AZURE_OPENAI_API_KEY", ""),
                            api_version    = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
                        )
                        _deploy = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME") or os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
                        async with _client as _az:
                            _resp = await _az.chat.completions.create(
                                model      = _deploy,
                                max_tokens = 120,
                                temperature= 0,
                                messages   = [{
                                    "role": "user",
                                    "content": (
                                        "Read this job description and extract ALL required technical skills, tools, "
                                        "technologies, and competencies.\n"
                                        "Rules:\n"
                                        "- Return ONLY a comma-separated list of short English skill names (1-4 words each)\n"
                                        "- Normalize French to English: 'Réseaux' → 'Networking', "
                                        "'Systèmes d exploitation' → 'Operating Systems', "
                                        "'Maintenance hardware' → 'Hardware Maintenance'\n"
                                        "- Include protocols, tools, methodologies\n"
                                        "- NO soft skills (teamwork, communication, etc.)\n"
                                        "- If nothing technical found, return empty string\n\n"
                                        f"Description:\n{description[:2500]}\n\n"
                                        "Skills:"
                                    )
                                }],
                            )
                        raw = _resp.choices[0].message.content.strip().strip('`"\'')
                        # Garder seulement la première ligne (évite les explications parasites)
                        skills = raw.split('\n')[0].strip()
                        logger.info(f"  [keejob/llm_skills] extracted: {skills[:100]}")
                    except Exception as _e:
                        logger.warning(f"  [keejob/llm_skills] LLM failed, fallback regex: {_e}")
                        skills = extract_tech_from_description(description)
        else:
            skills = ""
        # ── Remote final (si pas de mobilité dans sidebar, inférer) ──────────────
        if not remote:
            remote = _infer_remote(description + " " + title)

        logger.info(
            f"  [keejob/detail] '{title[:35]}' | "
            f"company='{company}' | loc='{location}' | "
            f"salary='{salary}' | contract='{contract}' | "
            f"exp='{experience}' | remote='{remote}' | "
            f"desc={len(description)}c | skills={skills[:50]}"
        )

        return {
            "title":       title,
            "industry":    company,          # Champ "industry" = nom société dans le pipeline
            "location":    location,
            "remote":      remote,
            "salary":      salary,
            "contract":    contract,
            "experience":  experience,
            "education":   education,
            "pub_date":    time_ago,
            "expired":     "",
            "description": description,
            "skills_req":  skills,
            "skills_bon":  "",
            "all_skills":  skills,
            "tags":        industry,         # Secteur d'activité
        }


# ══════════════════════════════════════════════════════════════════════════════
#  NIVEAU 1 : Parser listing page
# ══════════════════════════════════════════════════════════════════════════════

def _parse_article(article: Tag) -> dict | None:
    """
    Parse une <article class="bg-white dark:bg-gray-800 ..."> du listing keejob.
    Fournit les données de base pour le filtre cosine.

    BUGS CORRIGÉS :
      - Société : prend le 1er lien /companies/ avec texte non vide
                  (le lien logo n'a pas de texte → skippé)
      - Loc/Date : lecture des classes sans icon.extract() (pas de mutation DOM)
    """
    # Titre + URL
    h2 = article.find("h2")
    if not h2:
        return None
    title_link = h2.find("a", href=re.compile(r"/offres-emploi/\d+/"))
    if not title_link:
        return None
    title = _clean(title_link.get_text())
    if not title:
        return None
    href = title_link.get("href", "")
    url  = href if href.startswith("http") else f"{KEEJOB_BASE}{href}"

    # Société — FIX : cherche le 1er lien /companies/ avec du texte (≥ 2 chars)
    company = ""
    for a_tag in article.find_all("a", href=re.compile(r"/offres-emploi/companies/")):
        t = _clean(a_tag.get_text())
        if t and len(t) >= 2:
            company = t
            break

    # Tags colorés (secteur / contrat / salaire) — FIX : pas d'extract()
    industry = ""
    contract = ""
    salary   = ""
    for span in article.find_all("span", class_=True):
        icon = span.find("i", class_=True)
        if not icon:
            continue
        icls    = _icon_cls(icon)                    # Lecture seule, sans mutation
        txt     = _clean(span.get_text())            # Inclut le "texte" de l'icône (vide)
        if "fa-industry"       in icls and not industry: industry = txt
        elif "fa-briefcase"    in icls and not contract: contract = txt
        elif "fa-money-bill-wave" in icls and not salary: salary  = txt

    if not salary:
        salary = "Non spécifié"

    # Description (snippet)
    description = ""
    for p in article.find_all("p"):
        p_cls = " ".join(p.get("class") or [])
        if "text-gray-700" in p_cls and "text-sm" in p_cls:
            description = _clean(p.get_text())[:800]
            break

    # Localisation + Date — FIX : pas de mutation DOM
    location = ""
    raw_date = ""
    for div in article.find_all("div"):
        if "whitespace-nowrap" not in " ".join(div.get("class") or []):
            continue
        icon = div.find("i")
        if not icon:
            continue
        icls    = _icon_cls(icon)
        span_el = div.find("span")
        text    = _clean(span_el.get_text()) if span_el else _clean(div.get_text())
        if "fa-map-marker-alt" in icls and not location: location = text
        elif "fa-clock"        in icls and not raw_date: raw_date = text

    pub_dt   = _parse_date_fr(raw_date)
    time_ago = _age_label(pub_dt)

    return {
        "title":               title,
        "url":                 url,
        "company":             company,
        "location":            location,
        "salary":              salary,
        "remote":              _infer_remote(description + " " + title),
        "time_ago":            time_ago,
        "_pub_dt":             pub_dt,
        "_keejob_description": description,
        "_keejob_contract":    contract,
        "_keejob_experience":  "",
        "_keejob_skills":      "",
        "_keejob_industry":    industry,
    }


def _parse_page(html: str) -> tuple[list[dict], bool, bool]:
    soup     = BeautifulSoup(html, "html.parser")
    articles = soup.find_all("article", class_=lambda c: c and "bg-white" in c)

    if not articles:
        ids = set(re.findall(r'/offres-emploi/(\d+)/', html))
        logger.info(
            f"  [keejob/parse] 0 <article> | offre_ids={len(ids)} | "
            f"html={len(html)}c"
        )
        text_lower = soup.get_text(" ").lower()
        no_result  = any(p in text_lower for p in
                         ("aucun résultat", "aucune offre", "0 offre"))
        return [], False, not no_result

    logger.info(f"  [keejob/parse] {len(articles)} articles trouvés")
    jobs: list[dict] = []
    stop_early = False

    for article in articles:
        job = _parse_article(article)
        if job is None:
            continue
        pub_dt = job.pop("_pub_dt", None)
        if _too_old(pub_dt):
            logger.info(
                f"  [keejob/parse] Stop early — '{job['title'][:40]}' "
                f"pub_dt={pub_dt}"
            )
            stop_early = True
            break
        jobs.append(job)

    return jobs, stop_early, True


def _has_next_page(html: str) -> bool:
    soup = BeautifulSoup(html, "html.parser")
    if soup.find("a", string=re.compile(r"(suivant|next|›|»)", re.I)):
        return True
    return bool(soup.find_all("a", href=re.compile(r"[?&]page=\d+")))


async def _fetch_page(
    keyword: str, page: int, session: aiohttp.ClientSession
) -> tuple[str | None, int]:
    params = {"keywords": keyword}
    if page > 1:
        params["page"] = str(page)
    qs  = "&".join(f"{k}={quote_plus(str(v))}" for k, v in params.items())
    url = f"{KEEJOB_SEARCH}?{qs}"
    logger.info(f"  [keejob] GET page={page} kw='{keyword}' → {url}")
    try:
        async with session.get(
            url, headers=KEEJOB_HEADERS, timeout=HTTP_TIMEOUT, allow_redirects=True
        ) as resp:
            html  = await resp.text(encoding="utf-8", errors="replace")
            n_ids = len(set(re.findall(r'/offres-emploi/(\d+)/', html)))
            logger.info(
                f"  [keejob] status={resp.status} | html={len(html)}c | "
                f"offre_ids={n_ids}"
            )
            return html, resp.status
    except asyncio.TimeoutError:
        logger.warning(f"  [keejob] Timeout kw='{keyword}' page={page}")
        return None, 0
    except Exception as exc:
        logger.error(f"  [keejob] fetch error: {exc}")
        return None, 0


# ══════════════════════════════════════════════════════════════════════════════
#  Fonction principale exportée
# ══════════════════════════════════════════════════════════════════════════════

async def scrape_keejob(
    query:   str,
    session: aiohttp.ClientSession,
):
    """
    Async generator — yield chaque job IMMÉDIATEMENT dès détection.

    Le pipeline reçoit chaque job au fur et à mesure :
      page 1 → yield job1, job2, job3  → handle_job() → cosine → enrich → SSE + DB
      page 2 → yield job4, job5        → handle_job() → ...
      ...

    Arrêt automatique si offre >= MAX_AGE_DAYS (45j) détectée.
    """
    logger.info(f"[keejob] START — query='{query}'")
    keywords   = _build_queries(query)
    seen_urls: set[str] = set()
    total      = 0

    for keyword in keywords:
        if total >= DEFAULT_MAX_JOBS:
            break

        for page in range(1, MAX_PAGES + 1):
            if total >= DEFAULT_MAX_JOBS:
                break

            html, status = await _fetch_page(keyword, page, session)
            if html is None or status != 200:
                break

            jobs, stop_early, has_results = _parse_page(html)

            for job in jobs:
                if job["url"] not in seen_urls:
                    seen_urls.add(job["url"])
                    total += 1
                    # ── Yield immédiat → pipeline traite sans attendre ────────
                    logger.debug(f"  [keejob] yield #{total} '{job['title'][:40]}'")
                    yield job

            logger.info(
                f"  [keejob] kw='{keyword}' page={page}: "
                f"{len(jobs)} jobs (total={total}, stop={stop_early})"
            )

            if stop_early:
                logger.info(f"  [keejob] Arrêt — offre >= {MAX_AGE_DAYS}j")
                return   # ← stoppe le generator proprement

            if not has_results or not jobs:
                logger.info(f"  [keejob] Fin — aucun résultat pour '{keyword}'")
                break

            if not _has_next_page(html):
                logger.info(f"  [keejob] Fin pagination kw='{keyword}'")
                break

            await asyncio.sleep(DELAY_PAGES)

    logger.info(f"[keejob] TOTAL yielded: {total} offres")