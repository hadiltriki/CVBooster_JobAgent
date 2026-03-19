"""
scorer.py
---------
Rôle : Calculer le score ATS multi-dimensionnel à partir des JSONs
       structurés du CV et de la JD, et des résultats du matcher sémantique.
       Génère également les suggestions d'amélioration.
"""

import re
from ats_matcher import match_skills, semantic_similarity



def _safe_to_int(value) -> int | None:
    """
    BUG FIX 3 : Convertit en int de façon sécurisée.
    GPT-4o peut retourner : 3 (int), "3" (str), "3 ans", "3+", "3 years", None.
    """
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    # Extraire le premier nombre du texte ("3 ans" → 3, "3+" → 3)
    match = re.search(r'\d+', str(value))
    return int(match.group()) if match else None


WEIGHTS = {
    "skills_required":  0.55,   # Compétences obligatoires (le plus important)
    "skills_preferred": 0.10,   # Compétences souhaitées
    "experience":       0.15,   # Années d'expérience
    "designation":      0.10,   # Titre du poste
    "degree":           0.05,   # Diplôme
    "languages":        0.05,   # Langues
}


DEGREE_HIERARCHY = {
    "high school": 1, "baccalauréat": 1,
    "associate": 2,
    "bachelor": 3, "licence": 3, "undergraduate": 3,
    "master": 4, "msc": 4, "mba": 4, "meng": 4,
    "phd": 5, "doctorate": 5,
}


def _degree_score(cv_degree: str | None, required_degree: str | None) -> float:
    """Compare le diplôme du candidat avec le diplôme requis."""
    if not required_degree:
        return 1.0   # Aucun diplôme requis → score maximal

    if not cv_degree:
        return 0.0   # Diplôme requis mais non fourni

    cv_deg_lower  = cv_degree.lower()
    req_deg_lower = required_degree.lower()

    # Recherche dans la hiérarchie
    cv_level  = next((v for k, v in DEGREE_HIERARCHY.items() if k in cv_deg_lower), None)
    req_level = next((v for k, v in DEGREE_HIERARCHY.items() if k in req_deg_lower), None)

    if cv_level is None or req_level is None:
        # Pas trouvé dans la hiérarchie → similarité sémantique
        return semantic_similarity(cv_degree, required_degree)

    if cv_level >= req_level:
        return 1.0                        # Diplôme suffisant ou supérieur
    else:
        return max(0.0, cv_level / req_level)   # Diplôme insuffisant → ratio


def _experience_score(cv_years: int | None, required_years: int | None) -> float:
    """Compare les années d'expérience."""
    if required_years is None or required_years == 0:
        return 1.0          # Aucune expérience requise

    if cv_years is None:
        return 0.0          # Non renseigné → pénalité

    if cv_years >= required_years:
        return 1.0
    else:
        # Score proportionnel : 2 ans pour 4 requis → 0.50
        return round(cv_years / required_years, 3)


def _language_score(cv_languages: list[str], required_languages: list[str]) -> float:
    """Vérifie que les langues requises sont couvertes par le candidat."""
    if not required_languages:
        return 1.0

    if not cv_languages:
        return 0.0

    cv_langs_lower  = [l.lower() for l in cv_languages]
    req_langs_lower = [l.lower() for l in required_languages]

    matched = sum(1 for lang in req_langs_lower if lang in cv_langs_lower)
    return round(matched / len(req_langs_lower), 3)




def compute_ats_score(cv_data: dict, jd_data: dict) -> dict:
    """
    Calcule le score ATS global et les sous-scores pour chaque dimension.

    Args:
        cv_data : JSON structuré du CV (sortie de structurer.structure_cv)
        jd_data : JSON structuré de la JD (sortie de structurer.structure_jd)

    Returns:
        dict avec :
            - total_score        : int (0–100)
            - breakdown          : sous-scores par dimension
            - skills_result      : détail du matching des compétences obligatoires
            - preferred_result   : détail du matching des compétences souhaitées
            - missing_required   : compétences obligatoires manquantes
            - missing_preferred  : compétences souhaitées manquantes
            - suggestions        : liste de conseils personnalisés
    """

    
    cv_skills            = cv_data.get("skills") or []
    jd_required_skills   = jd_data.get("required_skills") or []
    jd_preferred_skills  = jd_data.get("preferred_skills") or []

    cv_experience  = _safe_to_int(cv_data.get("years_of_experience"))
    jd_experience  = _safe_to_int(jd_data.get("required_experience_years"))

    cv_degree      = cv_data.get("degree")
    jd_degree      = jd_data.get("required_degree")

    cv_designation = cv_data.get("current_designation") or ""
    jd_designation = jd_data.get("job_title") or ""

    cv_languages   = cv_data.get("languages") or []
    jd_languages   = jd_data.get("required_languages") or []

    
    skills_result    = match_skills(cv_skills, jd_required_skills,  threshold=0.65)
    preferred_result = match_skills(cv_skills, jd_preferred_skills, threshold=0.60)

    
    s_required   = skills_result["match_rate"]
    s_preferred  = preferred_result["match_rate"]
    s_experience = _experience_score(cv_experience, jd_experience)
    s_degree     = _degree_score(cv_degree, jd_degree)
    s_designation = semantic_similarity(cv_designation, jd_designation)
    s_languages  = _language_score(cv_languages, jd_languages)

    
    total = (
        s_required    * WEIGHTS["skills_required"]  +
        s_preferred   * WEIGHTS["skills_preferred"] +
        s_experience  * WEIGHTS["experience"]       +
        s_designation * WEIGHTS["designation"]      +
        s_degree      * WEIGHTS["degree"]           +
        s_languages   * WEIGHTS["languages"]
    )
    total_score = min(100, round(total * 100, 1))

    
    suggestions = _generate_suggestions(
        missing_required  = skills_result["missing"],
        missing_preferred = preferred_result["missing"],
        s_experience      = s_experience,
        cv_experience     = cv_experience,
        jd_experience     = jd_experience,
        s_degree          = s_degree,
        cv_degree         = cv_degree,
        jd_degree         = jd_degree,
        s_languages       = s_languages,
        jd_languages      = jd_languages,
        cv_languages      = cv_languages,
    )

    return {
        "total_score":       total_score,
        "breakdown": {
            "required_skills":  round(s_required   * 100, 1),
            "preferred_skills": round(s_preferred  * 100, 1),
            "experience":       round(s_experience * 100, 1),
            "designation":      round(s_designation* 100, 1),
            "degree":           round(s_degree     * 100, 1),
            "languages":        round(s_languages  * 100, 1),
        },
        "skills_result":     skills_result,
        "preferred_result":  preferred_result,
        "missing_required":  skills_result["missing"],
        "missing_preferred": preferred_result["missing"],
        "suggestions":       suggestions,
    }




def _generate_suggestions(
    missing_required, missing_preferred,
    s_experience, cv_experience, jd_experience,
    s_degree, cv_degree, jd_degree,
    s_languages, jd_languages, cv_languages
) -> list[str]:
    """Generates personalized tips based on detected gaps."""
    tips = []

    if missing_required:
        skills_str = ", ".join(f"**{s}**" for s in missing_required[:5])
        tips.append(f"🔴 **Missing required skills**: {skills_str}. "
                    f"Add them explicitly to your CV if you have experience with them.")

    if missing_preferred:
        skills_str = ", ".join(f"**{s}**" for s in missing_preferred[:3])
        tips.append(f"🟡 **Missing preferred skills**: {skills_str}. "
                    f"Having these would make your profile more competitive.")

    if s_experience < 0.8 and jd_experience:
        tips.append(f"📅 **Experience**: This role requires {jd_experience} years. "
                    f"Highlight personal projects, internships and freelance work "
                    f"to compensate for the gap in professional experience.")

    if s_degree < 0.8 and jd_degree:
        tips.append(f"🎓 **Education**: This role requires '{jd_degree}'. "
                    f"Emphasize your professional certifications "
                    f"to strengthen your application.")

    if s_languages < 1.0 and jd_languages:
        missing_langs = [l for l in jd_languages
                         if l.lower() not in [x.lower() for x in cv_languages]]
        if missing_langs:
            tips.append(f"🌐 **Languages**: '{', '.join(missing_langs)}' required. "
                        f"Add your proficiency level for this language if applicable.")

    if not tips:
        tips.append("✅ Your profile is a strong match for this role. "
                    "Prepare for the interview!")

    return tips