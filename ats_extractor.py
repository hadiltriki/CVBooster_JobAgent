"""
ats_extractor.py
----------------
Rôle : Préparer le texte brut du CV pour le scoring ATS.
       Contrairement au projet collègue (qui parse PDF/DOCX),
       ici le CV est déjà en texte brut dans CosmosDB (champ cv_raw_text).
       On fait uniquement le nettoyage / normalisation.
"""

import re


# ─────────────────────────────────────────────
#  NETTOYAGE DU TEXTE
# ─────────────────────────────────────────────

def preprocess_text(text: str) -> str:
    """
    Nettoie le texte CV :
    - Corrige les artefacts d'encodage courants (UTF-8 mal décodé)
    - Supprime les sauts de ligne excessifs
    - Normalise les espaces
    """
    # Artefacts d'encodage fréquents dans les PDFs / copier-coller
    encoding_fixes = {
        'â€"':  '–',
        'â€"':  '—',
        'â€˜':  '\u2018',
        'â€™':  '\u2019',
        'â€œ':  '\u201c',
        'â€\x9d': '\u201d',
        'â€¢':  '•',
        'â€¦':  '…',
        'Ã©':   'é',
        'Ã¨':   'è',
        'Ã ':   'à',
        'Ã¢':   'â',
        'Ã´':   'ô',
        'Ã®':   'î',
        'Ã»':   'û',
        'Ã¼':   'ü',
        'Ã±':   'ñ',
        'Ã§':   'ç',
        'â‚¬':  '€',
    }
    for wrong, correct in encoding_fixes.items():
        text = text.replace(wrong, correct)

    # Normalisation des fins de ligne Windows
    text = re.sub(r'\r\n', '\n', text)
    # Max 2 sauts de ligne consécutifs
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Espaces multiples → un seul
    text = re.sub(r'[ \t]+', ' ', text)

    return text.strip()


# ─────────────────────────────────────────────
#  FONCTION PRINCIPALE
# ─────────────────────────────────────────────

def prepare_cv_text(cv_text: str) -> str:
    """
    Point d'entrée unique.
    Reçoit le texte brut du CV depuis CosmosDB (champ cv_raw_text)
    et retourne un texte propre prêt pour GPT-4o.

    Args:
        cv_text : Texte brut du CV (depuis user["cv_raw_text"])

    Returns:
        str : Texte nettoyé

    Raises:
        ValueError : Si le texte est vide ou trop court
    """
    if not cv_text or not isinstance(cv_text, str):
        raise ValueError(
            "Le texte CV est vide. "
            "Assurez-vous que cv_raw_text est bien enregistré dans CosmosDB."
        )

    cleaned = preprocess_text(cv_text)

    if len(cleaned.strip()) < 50:
        raise ValueError(
            f"Le texte CV est trop court ({len(cleaned)} caractères). "
            "Vérifiez que cv_raw_text contient bien le texte complet du CV."
        )

    return cleaned