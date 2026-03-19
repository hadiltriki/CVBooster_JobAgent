# ─────────────────────────────────────────────────────────────────────────────
# explain_ats.py — xAI explanation module
# Imported by main.py:  from explain_ats import explain_ats_score
# ─────────────────────────────────────────────────────────────────────────────
import re
import json
import logging, os
from openai import AzureOpenAI

log = logging.getLogger("cv_booster")
AZURE_DEPLOYMENT = (
    os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME") or
    os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
)
client = AzureOpenAI(
    api_version    = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", ""),
    api_key        = os.getenv("AZURE_OPENAI_API_KEY", ""),
)


# ─────────────────────────────────────────────────────────────────────────────
# xAI — GPT-powered explanation of EVERY criterion
# ─────────────────────────────────────────────────────────────────────────────

def explain_ats_score(cv_text: str, score_result: dict, domain: str) -> dict:
    breakdown = score_result.get("breakdown", {})
    scorer_lines = []
    for key, val in breakdown.items():
        scorer_lines.append(f"  {key}: {val['score']}/{val['max']} pts | detail: {val.get('detail','')}")
    scorer_summary = "\n".join(scorer_lines)

    prompt = f"""You are a senior ATS auditor with 10 years of experience.

Your job: read the CV below and write a SURGICAL explanation of why each criterion received its score.
You must be SPECIFIC — cite actual content from the CV, name actual missing items, give concrete fixes.

=== AUTOMATED SCORER RESULTS ===
Domain: {domain}
Total: {score_result['total']}/100

{scorer_summary}

=== CV TEXT ===
{cv_text[:3500]}

=== YOUR TASK ===
For each of the 8 criteria, explain with maximum precision.
Respond ONLY with a JSON object — no text before or after.

Required JSON structure:
{{
  "sections": {{"why": "...", "found": [...], "missing": [...], "fix": "...", "impact": "+X pts"}},
  "skills":   {{"why": "...", "found": [...], "missing": [...], "fix": "...", "impact": "+X pts"}},
  "experience":{{"why": "...", "found": [...], "missing": [...], "fix": "...", "impact": "+X pts"}},
  "length":   {{"why": "...", "found": [...], "missing": [...], "fix": "...", "impact": "+X pts"}},
  "contact":  {{"why": "...", "found": [...], "missing": [...], "fix": "...", "impact": "+X pts"}},
  "keywords": {{"why": "...", "found": [...], "missing": [...], "fix": "...", "impact": "+X pts"}},
  "summary":  {{"why": "...", "found": [...], "missing": [...], "fix": "...", "impact": "+X pts"}},
  "languages":{{"why": "...", "found": [...], "missing": [...], "fix": "...", "impact": "+X pts"}}
}}

CRITICAL RULES:
- Every "why" must cite ACTUAL content from the CV — not generic text
- Every "missing" must be SPECIFIC (e.g. 'Docker and Git are missing', not 'improve your skills')
- Every "fix" must be a concrete action the person can do TODAY
- "found" and "missing" arrays: 2-5 items max, each max 12 words
- "why": 2-3 sentences max
- "fix": 1-2 sentences, concrete and actionable
"""

    try:
        resp = client.chat.completions.create(
            model=AZURE_DEPLOYMENT,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=2500,
        )
        raw = resp.choices[0].message.content.strip()
        raw = re.sub(r"```json\s*|```\s*", "", raw).strip()
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match: raw = match.group()
        explanation = json.loads(raw)
        log.info("✓ xAI explanation generated (%d criteria)", len(explanation))
        return explanation
    except Exception as e:
        log.error("explain_ats_score error: %s", e)
        fallback = {}
        for key, val in breakdown.items():
            pts_left = val["max"] - val["score"]
            fallback[key] = {
                "why":     val.get("detail", "Calculated automatically."),
                "found":   [], "missing": [],
                "fix":     f"Review this section — {pts_left} pts still available.",
                "impact":  f"+{pts_left} pts possible",
            }
        return fallback