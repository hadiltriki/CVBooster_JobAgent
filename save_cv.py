# ─────────────────────────────────────────────────────────────────────────────
# save_cv.py — CV workflow endpoints
#
#   POST /extract-cv               → extract text + detect missing sections
#   POST /save-cv                  → merge CV + platform data → save to CosmosDB
#   GET  /platform-data/{user_id}  → real quiz + labs + certs from PostgreSQL
#
# Imported by main.py:  import save_cv
# ─────────────────────────────────────────────────────────────────────────────
import json
import re
import logging
import os

from fastapi import UploadFile, File, Form, Path as FPath
from fastapi.responses import JSONResponse
from azure.cosmos import CosmosClient, PartitionKey, exceptions as cosmos_exceptions
from openai import AzureOpenAI

from main import app

# ── Logger ────────────────────────────────────────────────────────────────────
log = logging.getLogger("cv_booster")

# ── Azure OpenAI ──────────────────────────────────────────────────────────────
AZURE_DEPLOYMENT = (
    os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME") or
    os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
)

client = AzureOpenAI(
    api_version    = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", ""),
    api_key        = os.getenv("AZURE_OPENAI_API_KEY", ""),
)

# ── CosmosDB ──────────────────────────────────────────────────────────────────
COSMOS_ENDPOINT  = os.getenv("AZURE_COSMOS_ENDPOINT", "")
COSMOS_KEY       = os.getenv("AZURE_COSMOS_KEY", "")
COSMOS_DB        = os.getenv("AZURE_COSMOS_DATABASE_NAME", "EduTech_AI_Production")
COSMOS_CONTAINER = os.getenv("AZURE_COSMOS_USERS_CONTAINER", "users")

from db_platform import get_platform_data_or_fallback, fetch_recommendations
from cv_extraction import extract_text_from_pdf, extract_text_from_docx


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS — TEXT CLEANING
# ─────────────────────────────────────────────────────────────────────────────

_NOISE_MARKERS = [
    "cher(e) candidat(e)", "merci d'avoir téléchargé", "copyright :",
    "créeruncv.com", "creeruncv.com", "canva.com", "cvdesignr.com",
    "resumegenius.com", "nous espérons qu'il vous aidera",
    "besoin de conseils pour rédiger", "disclaimer :",
    "reproduction strictement interdite", "----------------",
    "nous vous souhaitons bonne chance", "modèle de cv",
]

def _clean_noise(text: str) -> str:
    lines, skip = [], False
    for line in text.split("\n"):
        ll = line.lower().strip()
        if any(m in ll for m in _NOISE_MARKERS):
            skip = True
        if not skip:
            lines.append(line)
    return "\n".join(lines)


def _has_real_content(text: str):
    if not text or len(text.strip()) < 80:
        return False, "The CV file appears to be empty."
    text = _clean_noise(text)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    year_re = re.compile(r"(20\d{2}|19\d{2})")
    _ALL_PH = {
        "titre du poste", "poste occupé", "job title", "position title",
        "your job title", "nom du poste", "intitulé du poste",
        "diplôme – université", "degree – university", "university name",
        "école / université", "nom de l'école", "school name",
    }
    real_n, ph_n = 0, 0
    for line in lines:
        if not year_re.search(line): continue
        if any(ph in line.lower() for ph in _ALL_PH):
            ph_n += 1
        else:
            real_n += 1
    if real_n == 0 and ph_n > 0:
        return False, "Your CV appears to be an unfilled template."
    return True, ""


SECTION_HEADERS_RE = {
    "profile":        re.compile(r"^(profile|profil|about|objective|summary|résumé|resume|présentation|professional summary|about me)$", re.I),
    "education":      re.compile(r"^(education|formation|éducation|études|diplômes?|qualifications?)$", re.I),
    "experience":     re.compile(r"^(experience|expérience|expérience professionnelle|professional experience|work experience|internships?)$", re.I),
    "skills":         re.compile(r"^(skills?|technical skills?|compétences?|technologies|core skills?|expertise)$", re.I),
    "projects":       re.compile(r"^(projects?|academic projects?|projets?|portfolio)$", re.I),
    "certifications": re.compile(r"^(certif\w*|badges?|awards?|achievements?|training)$", re.I),
    "languages":      re.compile(r"^(languages?|langues?|spoken languages?)$", re.I),
}

def parse_cv_sections(text: str) -> dict:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    sections = {"header": []}
    current = "header"
    for line in lines:
        matched = next((k for k, p in SECTION_HEADERS_RE.items()
                        if p.match(line) and len(line) < 60), None)
        if matched:
            current = matched
            sections.setdefault(current, [])
        else:
            sections.setdefault(current, [])
            sections[current].append(line)
    return sections


def detect_domain(cv_text: str) -> str:
    try:
        resp = client.chat.completions.create(
            model=AZURE_DEPLOYMENT,
            messages=[{"role": "user", "content": (
                "Read this CV extract and return ONLY the professional domain "
                "in 2-4 words (English). Examples: 'Data Engineering', 'Web Development'.\n"
                f"Return ONLY the domain name.\n\n{cv_text[:1500]}"
            )}],
            max_tokens=15, temperature=0,
        )
        return resp.choices[0].message.content.strip().strip("\"'")
    except Exception:
        return "Data Science"


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — LANGUAGES STRING  (niveau module)
# ─────────────────────────────────────────────────────────────────────────────

def _build_languages_str(
    languages_extra: list,
    cv_structured: dict,
    existing: dict,
) -> str:
    """
    Construit une string de langues ex: "English, French"
    Priorité : form > CV structuré > existant en DB
    """
    # 1. Langues saisies dans le formulaire
    if languages_extra:
        result = ", ".join(
            r.get("language", "").strip()
            for r in languages_extra
            if isinstance(r, dict) and r.get("language", "").strip()
        )
        if result:
            return result

    # 2. Langues extraites du CV
    cv_langs = cv_structured.get("languages", "")
    if isinstance(cv_langs, list):
        result = ", ".join(str(l).strip() for l in cv_langs if str(l).strip())
        if result:
            return result
    if isinstance(cv_langs, str) and cv_langs.strip():
        return cv_langs.strip()

    # 3. Fallback existant en DB
    existing_langs = existing.get("languages", "")
    if isinstance(existing_langs, list):
        return ", ".join(str(l).strip() for l in existing_langs if str(l).strip())
    return str(existing_langs) if existing_langs else ""


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — BULLETS STRING  (niveau module)
# ─────────────────────────────────────────────────────────────────────────────

def _build_bullets_str(cv_structured: dict, existing: dict) -> str:
    """
    Construit une string de bullets depuis le CV structuré.
    Ex: "Built ML model achieving 87% accuracy; Designed Power BI dashboard"
    """
    bullets = cv_structured.get("bullets", "")
    if isinstance(bullets, str) and bullets.strip():
        return bullets.strip()

    # Générer depuis les projets si bullets absent
    projects = cv_structured.get("projects", [])
    if isinstance(projects, list) and projects:
        parts = []
        for p in projects[:3]:
            if isinstance(p, dict):
                desc = p.get("description", "").strip()
                if desc:
                    parts.append(desc[:120])
        if parts:
            return "; ".join(parts)

    return existing.get("bullets", "")


def _merge_extra_into_raw_text(raw_text: str, extra_data: dict) -> str:
    """
    Append user-provided missing sections to raw CV text so downstream
    extraction/enhancement can actually use them.
    """
    if not isinstance(extra_data, dict) or not extra_data:
        return raw_text

    blocks: list[str] = []

    # Languages
    langs = extra_data.get("languages", [])
    if isinstance(langs, list):
        lang_lines = []
        for row in langs:
            if not isinstance(row, dict):
                continue
            language = str(row.get("language", "")).strip()
            level = str(row.get("level", "")).strip()
            if language and level:
                lang_lines.append(f"- {language} ({level})")
            elif language:
                lang_lines.append(f"- {language}")
        if lang_lines:
            blocks.append("LANGUAGES\n" + "\n".join(lang_lines))

    # Education
    education_rows = extra_data.get("education", [])
    if isinstance(education_rows, list):
        edu_lines = []
        for row in education_rows:
            if not isinstance(row, dict):
                continue
            degree = str(row.get("degree", "")).strip()
            university = str(row.get("university", "")).strip()
            start = str(row.get("start", "")).strip()
            end = str(row.get("end", "")).strip()
            present = bool(row.get("present", False))
            period = ""
            if start or end or present:
                period_end = "Present" if present else end
                period = f" ({start} - {period_end})".strip()
            if degree or university:
                main = " - ".join(part for part in [degree, university] if part)
                edu_lines.append(f"- {main}{period}")
        if edu_lines:
            blocks.append("EDUCATION\n" + "\n".join(edu_lines))

    # Experience
    experience_rows = extra_data.get("experience", [])
    if isinstance(experience_rows, list):
        exp_lines = []
        for row in experience_rows:
            if not isinstance(row, dict):
                continue
            title = str(row.get("title", "")).strip()
            company = str(row.get("company", "")).strip()
            location = str(row.get("location", "")).strip()
            description = str(row.get("description", "")).strip()
            start = str(row.get("start", "")).strip()
            end = str(row.get("end", "")).strip()
            present = bool(row.get("present", False))

            if not (title or company):
                continue

            role_company = " - ".join(part for part in [title, company] if part)
            period = ""
            if start or end or present:
                period_end = "Present" if present else end
                period = f" ({start} - {period_end})".strip()
            location_part = f" | {location}" if location else ""
            exp_lines.append(f"- {role_company}{period}{location_part}")
            if description:
                exp_lines.append(f"  {description}")
        if exp_lines:
            blocks.append("PROFESSIONAL EXPERIENCE\n" + "\n".join(exp_lines))

    if not blocks:
        return raw_text

    return raw_text.rstrip() + "\n\n" + "\n\n".join(blocks) + "\n"


# ─────────────────────────────────────────────────────────────────────────────
# CosmosDB helper
# ─────────────────────────────────────────────────────────────────────────────

def _get_cosmos_container():
    c  = CosmosClient(COSMOS_ENDPOINT, credential=COSMOS_KEY)
    db = c.create_database_if_not_exists(COSMOS_DB)
    return db.create_container_if_not_exists(
        id=COSMOS_CONTAINER,
        partition_key=PartitionKey(path="/id"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# LLM: extract structured fields from raw CV text
# ─────────────────────────────────────────────────────────────────────────────

def _extract_cv_structured(raw_text: str) -> dict:
    prompt = f"""You are a precise multilingual CV data extractor. The CV may be in French or English.

EXTRACTION RULES:

1. CERTIFICATIONS — JSON array, one object per certification:
   - Each cert: {{"title": "cert name", "org": "issuing org", "date": "year or empty"}}
   - Extract EVERY certification listed.

2. PROJECTS — JSON array, one object per project:
   - Each project: {{"title": "project title", "description": "description"}}
   - Extract EVERY project listed.

3. SKILLS — comma-separated string of ALL technical skills.

4. SUMMARY — copy the professional summary verbatim.

5. BULLETS — 2-3 key achievements as a single string separated by semicolons.
   Example: "Built ML model achieving 87% accuracy; Designed Power BI dashboard reducing report time by 60%"

6. LANGUAGES — comma-separated string of languages found in the CV.
   Example: "English, French"

Return ONLY valid JSON:
{{
  "first_name": "string",
  "last_name": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string or empty",
  "role": "current or target job title",
  "seniority": "Junior | Mid | Senior | Lead | Executive",
  "years_experience": "number as string",
  "industry": "string",
  "education": "highest degree + institution",
  "skills": "all skills comma-separated",
  "summary": "professional summary verbatim",
  "bullets": "key achievements semicolon-separated",
  "languages": "comma-separated languages",
  "certifications": [],
  "projects": []
}}

CV TEXT:
{raw_text[:6000]}
"""
    resp = client.chat.completions.create(
        model=AZURE_DEPLOYMENT,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
        temperature=0,
    )
    raw = resp.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    parsed = json.loads(raw)

    # Normalize certifications
    certs = parsed.get("certifications", [])
    if isinstance(certs, str):
        parsed["certifications"] = [{"title": c.strip(), "org": "", "date": ""} for c in certs.split(",") if c.strip()]
    elif isinstance(certs, list):
        normalized = []
        for c in certs:
            if isinstance(c, dict):
                normalized.append({"title": c.get("title", ""), "org": c.get("org", ""), "date": c.get("date", "")})
            elif isinstance(c, str) and c.strip():
                normalized.append({"title": c.strip(), "org": "", "date": ""})
        parsed["certifications"] = normalized

    # Normalize projects
    projects = parsed.get("projects", [])
    if isinstance(projects, str):
        parsed["projects"] = [{"title": p.strip(), "description": ""} for p in projects.split(",") if p.strip()]
    elif isinstance(projects, list):
        normalized = []
        for p in projects:
            if isinstance(p, dict):
                normalized.append({"title": p.get("title", ""), "description": p.get("description", "")})
            elif isinstance(p, str) and p.strip():
                normalized.append({"title": p.strip(), "description": ""})
        parsed["projects"] = normalized

    return parsed


# ─────────────────────────────────────────────────────────────────────────────
# Build CosmosDB document — format exact requis
# ─────────────────────────────────────────────────────────────────────────────

def _build_cosmos_doc(
    user_id: str,
    existing: dict,
    cv_structured: dict,
    domain: str,
    quiz_data: dict | None,
    labs_data: list,
    certs_data: list,
    extra_data: dict,
    raw_text: str = "",
) -> dict:

    languages_extra = extra_data.get("languages", [])

    doc = {
        "id":         user_id,
        # Identité
        "first_name": cv_structured.get("first_name") or existing.get("first_name", ""),
        "last_name":  cv_structured.get("last_name")  or existing.get("last_name", ""),
        "email":      cv_structured.get("email")      or existing.get("email", ""),
        "linkedin":   cv_structured.get("linkedin")   or existing.get("linkedin", ""),
        # Profil professionnel
        "role":       cv_structured.get("role")       or existing.get("role", ""),
        "seniority":  cv_structured.get("seniority")  or existing.get("seniority", ""),
        "years_exp":  cv_structured.get("years_experience") or existing.get("years_exp", "0"),
        "industry":   cv_structured.get("industry")   or existing.get("industry", ""),
        "education":  cv_structured.get("education")  or existing.get("education", ""),
        # Compétences & résumé
        "skills":     cv_structured.get("skills")     or existing.get("skills", ""),
        "summary":    cv_structured.get("summary")    or existing.get("summary", ""),
        "bullets":    _build_bullets_str(cv_structured, existing),
        "languages":  _build_languages_str(languages_extra, cv_structured, existing),
        # CV brut pour ATS scoring
        "cv_raw_text": raw_text or existing.get("cv_raw_text", ""),
        # Scores ATS conservés
        "ats_score_before": existing.get("ats_score_before", 0),
        "ats_score_after":  existing.get("ats_score_after", 0),
    }

    return doc


# ═════════════════════════════════════════════════════════════════════════════
# ENDPOINT 1 — POST /extract-cv
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/extract-cv")
async def extract_cv(file: UploadFile = File(...)):
    content  = await file.read()
    filename = (file.filename or "").lower()

    if filename.endswith(".pdf"):
        raw_text = extract_text_from_pdf(content)
    elif filename.endswith(".docx"):
        raw_text = extract_text_from_docx(content)
    elif filename.endswith(".txt"):
        raw_text = content.decode("utf-8", errors="ignore")
    else:
        return JSONResponse(
            {"error": "Unsupported file type. Please upload PDF, DOCX, or TXT."},
            status_code=400,
        )

    log.info("📄 /extract-cv — %d chars from %s", len(raw_text), file.filename)

    clean_text = _clean_noise(raw_text)
    ok, reason = _has_real_content(clean_text)
    if not ok:
        return JSONResponse({"error": reason}, status_code=422)

    sections = parse_cv_sections(raw_text)
    missing  = []
    if not sections.get("experience"):  missing.append("experience")
    if not sections.get("education"):   missing.append("education")
    if not sections.get("languages"):   missing.append("languages")

    log.info("🔍 Missing sections: %s", missing)

    return JSONResponse({
        "text":             raw_text,
        "missing_sections": missing,
    })


# ═════════════════════════════════════════════════════════════════════════════
# ENDPOINT 2 — POST /save-cv
# ═════════════════════════════════════════════════════════════════════════════

@app.post("/save-cv")
async def save_cv(
    file:       UploadFile = File(...),
    user_id:    str        = Form(""),
    quiz_data:  str        = Form("null"),
    labs_data:  str        = Form("[]"),
    certs_data: str        = Form("[]"),
    extra_data: str        = Form("{}"),
):
    if not user_id or user_id == "user_default":
        return JSONResponse({"error": "user_id is required to save."}, status_code=400)

    content  = await file.read()
    filename = (file.filename or "").lower()

    if filename.endswith(".pdf"):
        raw_text = extract_text_from_pdf(content)
    elif filename.endswith(".docx"):
        raw_text = extract_text_from_docx(content)
    elif filename.endswith(".txt"):
        raw_text = content.decode("utf-8", errors="ignore")
    else:
        return JSONResponse({"error": "Unsupported file type."}, status_code=400)

    log.info("📄 /save-cv — %d chars from %s — user: %s", len(raw_text), file.filename, user_id)

    try:
        quiz  = json.loads(quiz_data)
    except Exception:
        quiz  = None
    try:
        labs  = json.loads(labs_data)
    except Exception:
        labs  = []
    try:
        certs = json.loads(certs_data)
    except Exception:
        certs = []
    try:
        extra = json.loads(extra_data)
    except Exception:
        extra = {}

    merged_raw_text = _merge_extra_into_raw_text(raw_text, extra)
    domain = detect_domain(merged_raw_text)

    try:
        cv_structured = _extract_cv_structured(merged_raw_text)
        log.info("✓ CV structured — role=%s seniority=%s",
                 cv_structured.get("role"), cv_structured.get("seniority"))
    except Exception as e:
        log.error("⚠ LLM extraction failed: %s", e)
        cv_structured = {}

    # ── Load existing CosmosDB doc ────────────────────────────────────────────
    existing = {}
    try:
        container = _get_cosmos_container()
        try:
            existing = container.read_item(item=user_id, partition_key=user_id)
            log.info("✓ Existing doc found for user %s", user_id)
        except cosmos_exceptions.CosmosResourceNotFoundError:
            existing = {}
            log.info("No existing doc for user %s — creating new", user_id)
    except Exception as e:
        log.warning("⚠ CosmosDB read failed: %s", e)

    # ── Build + upsert ────────────────────────────────────────────────────────
    doc = _build_cosmos_doc(
        user_id=user_id,
        existing=existing,
        cv_structured=cv_structured,
        domain=domain,
        quiz_data=quiz,
        labs_data=labs,
        certs_data=certs,
        extra_data=extra,
        raw_text=merged_raw_text,
    )

    try:
        container = _get_cosmos_container()
        container.upsert_item(doc)
        log.info("✅ Saved user %s — role=%s skills=%s...",
                 user_id, doc.get("role"), str(doc.get("skills", ""))[:40])
    except Exception as e:
        log.error("❌ CosmosDB save failed: %s", e)
        return JSONResponse({"error": f"Database save failed: {str(e)}"}, status_code=500)

    return JSONResponse({
        "status":  "saved",
        "user_id": user_id,
        "domain":  domain,
    })


# ═════════════════════════════════════════════════════════════════════════════
# ENDPOINT 3 — GET /platform-data/{user_id}
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/platform-data/{user_id}")
async def get_platform_data(user_id: str = FPath(...)):
    data = get_platform_data_or_fallback(user_id)

    if data.get("status") == "ok":
        quiz_domain = (data.get("quiz") or {}).get("domain", "")
        recs = fetch_recommendations(user_id, quiz_domain)
        data["recommendations"] = recs
    else:
        data["recommendations"] = {"certifications": [], "labs": []}

    log.info("📡 /platform-data/%s → status=%s labs=%d certs=%d",
             user_id, data.get("status"),
             len(data.get("labs", [])),
             len(data.get("certifications", [])))

    return JSONResponse(data)