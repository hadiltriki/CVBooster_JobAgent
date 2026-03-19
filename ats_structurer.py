import os
import json
import time
from openai import AzureOpenAI, APIConnectionError, APIStatusError, RateLimitError
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# BUG FIX 4 : Validation des variables d'environnement
# ─────────────────────────────────────────────

_REQUIRED_ENV_VARS = ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT"]

def _validate_env():
    """Vérifie que toutes les variables .env sont définies et non vides."""
    missing = [v for v in _REQUIRED_ENV_VARS if not os.getenv(v)]
    if missing:
        raise EnvironmentError(
            f"Variables manquantes dans .env : {', '.join(missing)}\n"
            f"Vérifiez votre fichier .env à la racine du projet."
        )

_validate_env()


def get_client() -> AzureOpenAI:
    return AzureOpenAI(
        azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", ""),
        api_key        = os.getenv("AZURE_OPENAI_API_KEY",  ""),
        api_version    = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
    )

DEPLOYMENT = (
    os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")   # ← priorité : variable de TON projet
    or os.getenv("AZURE_OPENAI_DEPLOYMENT")
    or "gpt-4o-mini"
)
DEPLOYMENT = (
    os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    or os.getenv("AZURE_OPENAI_DEPLOYMENT")
    or "gpt-4o-mini"
)




CV_SYSTEM_PROMPT = """
You are an expert CV parser specialized in Human Resources.
Your task is to extract and structure information from a CV/Resume into a clean JSON object.

CRITICAL RULES:
1. Output ONLY valid JSON, no markdown, no explanation.
2. Translate ALL text to English (even if the CV is in French, Arabic, Spanish, etc.)
3. Normalize skill names to their standard English form:
   - "Apprentissage automatique" → "Machine Learning"
   - "Développeur" → "Developer"
   - "Génie logiciel" → "Software Engineering"
4. If a field is not found, use null.
5. Skills must be a flat list of normalized skill strings.
6. For years_of_experience, extract a number (integer) or null.
"""

CV_USER_PROMPT = """
Parse the following CV and return a JSON with this exact structure:

{{
  "name": "Full name of the candidate",
  "email": "email address or null",
  "phone": "phone number or null",
  "location": "City, Country in English or null",
  "degree": "Highest degree obtained in English (e.g. Master in Computer Science) or null",
  "graduation_year": "Year as string or null",
  "college_name": "University/School name or null",
  "years_of_experience": number or null,
  "current_designation": "Current or most recent job title in English or null",
  "companies_worked_at": ["Company1", "Company2"],
  "skills": ["skill1", "skill2", "skill3"],
  "certifications": ["cert1", "cert2"],
  "languages": ["English", "French"],
  "professional_summary": "One paragraph summary in English or null"
}}

CV TEXT:
{cv_text}
"""


def structure_cv(cv_text: str) -> dict:
    """
    Envoie le texte brut du CV à GPT-4o.

    Args:
        cv_text: Texte brut nettoyé du CV

    Returns:
        dict: JSON structuré du CV normalisé en anglais

    Raises:
        ValueError: Si GPT-4o retourne un JSON invalide
    """
    client = get_client()

    # BUG FIX 1 : Retry avec backoff exponentiel (3 tentatives)
    last_error = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=DEPLOYMENT,
                messages=[
                    {"role": "system", "content": CV_SYSTEM_PROMPT},
                    {"role": "user", "content": CV_USER_PROMPT.format(cv_text=cv_text)}
                ],
                temperature=0,
                response_format={"type": "json_object"},
                max_tokens=1500,
                timeout=30,
            )
            raw_json = response.choices[0].message.content
            try:
                return json.loads(raw_json)
            except json.JSONDecodeError as e:
                raise ValueError(f"GPT-4o n'a pas retourné un JSON valide : {e}\n{raw_json}")

        except RateLimitError:
            wait = 2 ** attempt
            time.sleep(wait)   # Attente exponentielle : 1s, 2s, 4s
            last_error = f"Rate limit dépassé. Réessai {attempt+1}/3..."
        except APIConnectionError as e:
            wait = 2 ** attempt
            time.sleep(wait)
            last_error = f"Erreur réseau Azure OpenAI : {e}"
        except APIStatusError as e:
            raise ValueError(f"Erreur Azure OpenAI ({e.status_code}) : {e.message}")

    raise ConnectionError(f"Échec après 3 tentatives. Dernière erreur : {last_error}")




JD_SYSTEM_PROMPT = """
You are an expert HR analyst specialized in job description parsing.
Your task is to extract and structure requirements from a job description into a clean JSON object.

CRITICAL RULES:
1. Output ONLY valid JSON, no markdown, no explanation.
2. Translate ALL text to English.
3. Normalize all skill/technology names to standard English form.
4. Separate required skills from nice-to-have/preferred skills.
5. If a field is not found, use null or empty list [].
"""

JD_USER_PROMPT = """
Parse the following job description and return a JSON with this exact structure:

{{
  "job_title": "Exact job title in English",
  "required_skills": ["must-have skill1", "skill2"],
  "preferred_skills": ["nice-to-have skill1", "skill2"],
  "required_experience_years": number or null,
  "required_degree": "Minimum required degree in English or null",
  "required_languages": ["English", "French"],
  "responsibilities": ["main responsibility 1", "responsibility 2"],
  "job_summary": "One paragraph summary of the role in English"
}}

JOB DESCRIPTION TEXT:
{jd_text}
"""


def structure_jd(jd_text: str) -> dict:
    """
    Envoie le texte de la description de poste à GPT-4o.

    Args:
        jd_text: Texte brut de la description de poste

    Returns:
        dict: JSON structuré de la JD normalisé en anglais

    Raises:
        ValueError: Si GPT-4o retourne un JSON invalide
    """
    client = get_client()

    # BUG FIX 1 : Retry avec backoff exponentiel (3 tentatives)
    last_error = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=DEPLOYMENT,
                messages=[
                    {"role": "system", "content": JD_SYSTEM_PROMPT},
                    {"role": "user", "content": JD_USER_PROMPT.format(jd_text=jd_text)}
                ],
                temperature=0,
                response_format={"type": "json_object"},
                max_tokens=1000,
                timeout=30,
            )
            raw_json = response.choices[0].message.content
            try:
                return json.loads(raw_json)
            except json.JSONDecodeError as e:
                raise ValueError(f"GPT-4o n'a pas retourné un JSON valide : {e}\n{raw_json}")

        except RateLimitError:
            wait = 2 ** attempt
            time.sleep(wait)
            last_error = f"Rate limit dépassé. Réessai {attempt+1}/3..."
        except APIConnectionError as e:
            wait = 2 ** attempt
            time.sleep(wait)
            last_error = f"Erreur réseau Azure OpenAI : {e}"
        except APIStatusError as e:
            raise ValueError(f"Erreur Azure OpenAI ({e.status_code}) : {e.message}")

    raise ConnectionError(f"Échec après 3 tentatives. Dernière erreur : {last_error}")