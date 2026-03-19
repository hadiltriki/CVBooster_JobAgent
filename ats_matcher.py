"""
matcher.py
----------
Rôle : Comparer sémantiquement les compétences du CV et de la JD
       en utilisant le modèle all-MiniLM-L6-v2 (sentence-transformers).
       Génère une matrice de similarité cosinus pour trouver les matchs.
"""

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import threading

# ─────────────────────────────────────────────
# BUG FIX 2 : Cache thread-safe du modèle MiniLM
# Utilise un Lock pour éviter le rechargement multiple
# lors des reruns Streamlit (sessions concurrentes)
# ─────────────────────────────────────────────

_model = None
_model_lock = threading.Lock()

def get_model() -> SentenceTransformer:
    """Charge all-MiniLM-L6-v2 une seule fois (thread-safe)."""
    global _model
    if _model is None:
        with _model_lock:
            # Double-check après acquisition du lock
            if _model is None:
                _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


# ─────────────────────────────────────────────
# MATCHING SÉMATIQUE DE COMPÉTENCES
# ─────────────────────────────────────────────

def match_skills(
    cv_skills: list[str],
    jd_skills: list[str],
    threshold: float = 0.65
) -> dict:
    """
    Compare sémantiquement les compétences du CV avec celles requises
    par la JD en utilisant la similarité cosinus sur les embeddings MiniLM.

    Args:
        cv_skills  : Liste de compétences extraites du CV (en anglais)
        jd_skills  : Liste de compétences requises par la JD (en anglais)
        threshold  : Seuil de similarité cosinus (0 à 1). 
                     Au-dessus → match ✅ | En-dessous → manquant ❌

    Returns:
        dict avec :
            - matched       : [(jd_skill, cv_skill, score)] compétences matchées
            - missing       : [jd_skill] compétences manquantes
            - match_rate    : float, taux de couverture des compétences JD
            - match_details : matrice complète des scores (debug)
    """
    if not cv_skills or not jd_skills:
        return {
            "matched": [],
            "missing": jd_skills,
            "match_rate": 0.0,
            "match_details": []
        }

    model = get_model()

    
    cv_embeddings  = model.encode(cv_skills,  normalize_embeddings=True)
    jd_embeddings  = model.encode(jd_skills,  normalize_embeddings=True)

    
    similarity_matrix = cosine_similarity(jd_embeddings, cv_embeddings)

    matched = []
    missing = []

    for jd_idx, jd_skill in enumerate(jd_skills):
        
        best_cv_idx   = int(np.argmax(similarity_matrix[jd_idx]))
        best_score    = float(similarity_matrix[jd_idx][best_cv_idx])
        best_cv_skill = cv_skills[best_cv_idx]

        if best_score >= threshold:
            matched.append({
                "jd_skill":    jd_skill,
                "cv_skill":    best_cv_skill,
                "score":       round(best_score, 3),
                "exact_match": jd_skill.lower() == best_cv_skill.lower()
            })
        else:
            missing.append(jd_skill)

    match_rate = len(matched) / len(jd_skills) if jd_skills else 0.0

    return {
        "matched":        matched,
        "missing":        missing,
        "match_rate":     round(match_rate, 3),
        "match_details":  similarity_matrix.tolist()   
    }



def semantic_similarity(text_a: str, text_b: str) -> float:
    """
    Calcule la similarité cosinus entre deux textes courts.
    Utilisé pour comparer le titre du poste CV ↔ JD, ou le diplôme.

    Args:
        text_a, text_b : Deux chaînes de texte en anglais

    Returns:
        float : Score de similarité entre 0.0 et 1.0
    """
    if not text_a or not text_b:
        return 0.0

    model = get_model()
    embeddings = model.encode([text_a, text_b], normalize_embeddings=True)
    score = float(cosine_similarity([embeddings[0]], [embeddings[1]])[0][0])
    return round(score, 3)