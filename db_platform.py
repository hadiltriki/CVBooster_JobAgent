# db_platform.py — CosmosDB pour users + PostgreSQL pour labs/certs
import os
import logging

log = logging.getLogger("cv_booster")

# ── PostgreSQL SUBUL (labs + certifications) ──────────────────────────────────
DB_HOST     = os.getenv("AZURE_HOST",     "c-shared-db-cluster.6uhq2s7lsktnhd.postgres.cosmos.azure.com")
DB_NAME     = os.getenv("AZURE_DB",       "shared-db")
DB_USER     = os.getenv("AZURE_USER",     "citus")
DB_PASSWORD = os.getenv("AZURE_PASSWORD", "Adminshareddb123")
DB_PORT     = int(os.getenv("AZURE_PORT", "5432"))

def _get_pg_conn():
    import psycopg2
    return psycopg2.connect(
        host=DB_HOST, dbname=DB_NAME, user=DB_USER,
        password=DB_PASSWORD, port=DB_PORT,
        sslmode="require", connect_timeout=8,
    )

# ── CosmosDB (users) ──────────────────────────────────────────────────────────
def _get_cosmos_user(user_id: str) -> dict | None:
    from azure.cosmos import CosmosClient, exceptions as cosmos_exceptions
    endpoint       = os.getenv("AZURE_COSMOS_ENDPOINT", "")
    key            = os.getenv("AZURE_COSMOS_KEY", "")
    db_name        = os.getenv("AZURE_COSMOS_DATABASE_NAME", "EduTech_AI_Production")
    container_name = os.getenv("AZURE_COSMOS_USERS_CONTAINER", "users")

    log.info("CosmosDB lookup → db=%s container=%s id=%s", db_name, container_name, user_id)

    try:
        c   = CosmosClient(endpoint, credential=key)
        db  = c.get_database_client(db_name)
        col = db.get_container_client(container_name)
        try:
            doc = col.read_item(item=str(user_id), partition_key=str(user_id))
            log.info("✓ User %s found in CosmosDB", user_id)
            return doc
        except cosmos_exceptions.CosmosResourceNotFoundError:
            # ── Ne pas créer — juste signaler que le user n'existe pas encore ─
            log.info("User %s not found in CosmosDB — will be created on save", user_id)
            return {"id": str(user_id), "_new": True}  # doc vide mais pas None
    except Exception as e:
        log.error("CosmosDB error: %s", e)
        return None
# ── PostgreSQL helpers ────────────────────────────────────────────────────────
def _fmt_date(dt) -> str:
    if dt is None: return ""
    if isinstance(dt, str): return dt
    try: return dt.strftime("%b %Y")
    except: return str(dt)

def _fetch_quiz(cur, uid: int):
    try:
        cur.execute("""
            SELECT domain, scores, "primaryProfile", completed_at
            FROM   assessment_results
            WHERE  user_id = %s AND scores IS NOT NULL
            ORDER  BY completed_at DESC LIMIT 1
        """, (uid,))
        row = cur.fetchone()
        if not row: return None
        scores_json = row[1] or {}
        profile_raw = row[2] or ""
        DOMAIN_MAP = {
            "cyberPercentage": "Cybersecurity",
            "aiPercentage":    "Artificial Intelligence & ML",
            "cloudPercentage": "Cloud Computing",
            "dataPercentage":  "Data Analytics & BI",
            "devPercentage":   "Software Engineering",
        }
        best_domain, best_pct = row[0] or "General", 0
        for key, label in DOMAIN_MAP.items():
            pct = scores_json.get(key, 0)
            if isinstance(pct, (int, float)) and pct > best_pct:
                best_pct, best_domain = pct, label
        total_score = int(best_pct) if best_pct > 0 else 0
        level = "Beginner"
        if total_score >= 75: level = "Expert"
        elif total_score >= 55: level = "Advanced"
        elif total_score >= 35: level = "Intermediate"
        return {"domain": best_domain, "score": total_score, "level": level}
    except Exception as e:
        log.error("Quiz fetch error uid=%s: %s", uid, e)
        cur.connection.rollback()
        return None

def _fetch_labs(cur, uid: int):
    try:
        cur.execute("""
            SELECT l.id, l.title, lp.time_spent, lp.completed_at
            FROM   lab_progress lp JOIN labs l ON l.id = lp.lab_id
            WHERE  lp.user_id = %s AND lp.is_completed = true
            ORDER  BY lp.completed_at DESC
        """, (uid,))
        rows = cur.fetchall()
        result = []
        for i, row in enumerate(rows):
            ts = row[2] or 0
            score = min(70 + min(ts // 10, 30), 100) if ts > 0 else 80
            result.append({
                "id":    f"lab{row[0]}",
                "title": row[1] or f"Lab {i+1}",
                "score": score,
                "date":  _fmt_date(row[3]),
            })
        return result
    except Exception as e:
        log.error("Labs fetch error uid=%s: %s", uid, e)
        cur.connection.rollback()
        return []

def _fetch_certifications(cur, uid: int):
    try:
        cur.execute("""
            SELECT DISTINCT c.id, c.title, c.provider, ucp.completed_at
            FROM   user_course_progress ucp
            JOIN   courses co       ON co.id = ucp.course_id
            JOIN   certifications c ON c.id  = co.certification_id
            WHERE  ucp.user_id = %s
            ORDER  BY ucp.completed_at DESC NULLS LAST
        """, (uid,))
        rows = cur.fetchall()
        return [
            {
                "id":    f"cert{r[0]}",
                "title": r[1] or f"Cert {r[0]}",
                "org":   r[2] or "Platform",
                "date":  _fmt_date(r[3]),
            }
            for r in rows
        ]
    except Exception as e:
        log.error("Certs fetch error uid=%s: %s", uid, e)
        cur.connection.rollback()
        return []

# ── Main function ─────────────────────────────────────────────────────────────
def fetch_platform_data(user_id: str) -> dict:
    if not user_id or user_id in ("", "user_default"):
        return {"status": "no_user_id", "quiz": None, "labs": [], "certifications": []}

    try:
        uid = int(user_id)
    except ValueError:
        return {"status": "invalid_user", "quiz": None, "labs": [], "certifications": []}

    # ── 1. Vérifier que l'user existe dans CosmosDB ───────────────────────────
    doc = _get_cosmos_user(user_id)
    if doc.get("_new"):
        log.info("User %s is new — no data yet", uid)
        return {"status": "no_data", "quiz": None, "labs": [], "certifications": []}

    log.info("✓ User ready in CosmosDB: id=%s %s %s",
            doc.get("id"), doc.get("first_name", ""), doc.get("last_name", ""))

    # ── 2. Charger labs + certifs depuis PostgreSQL SUBUL ─────────────────────
    try:
        conn = _get_pg_conn()
        cur  = conn.cursor()
        quiz  = _fetch_quiz(cur, uid)
        labs  = _fetch_labs(cur, uid)
        certs = _fetch_certifications(cur, uid)
        cur.close()
        conn.close()
    except Exception as e:
        log.error("PostgreSQL error user %s: %s", uid, e)
        # User existe dans CosmosDB mais PostgreSQL inaccessible → no_data
        return {"status": "no_data", "quiz": None, "labs": [], "certifications": []}

    # ── 3. User existe mais pas de données platform ───────────────────────────
    if not quiz and not labs and not certs:
        log.info("User %s exists but has no platform data in PostgreSQL", uid)
        return {"status": "no_data", "quiz": None, "labs": [], "certifications": []}

    return {
        "status":         "ok",
        "quiz":           quiz or {"domain": "General", "score": 0, "level": "Beginner"},
        "labs":           labs,
        "certifications": certs,
    }


def get_platform_data_or_fallback(user_id: str) -> dict:
    try:
        return fetch_platform_data(user_id)
    except Exception as e:
        log.error("Unexpected error: %s", e)
        return {"status": "db_error", "quiz": None, "labs": [], "certifications": []}


def fetch_recommendations(user_id: str, quiz_domain: str) -> dict:
    if not user_id or user_id in ("", "user_default"):
        return {"certifications": [], "labs": []}
    try:
        uid = int(user_id)
    except ValueError:
        return {"certifications": [], "labs": []}

    try:
        conn = _get_pg_conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT c.id, c.title, c.provider, c.domain, c.level, c.duration
            FROM   certifications c
            WHERE  c.available = true
              AND  c.id NOT IN (
                SELECT co.certification_id
                FROM   user_course_progress ucp
                JOIN   courses co ON co.id = ucp.course_id
                WHERE  ucp.user_id = %s
              )
            ORDER BY c.id
        """, (uid,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        all_certs = [
            {
                "id":       r[0],
                "title":    r[1] or "",
                "provider": r[2] or "",
                "domain":   r[3] or "",
                "level":    r[4] or "",
                "duration": r[5] or "",
            }
            for r in rows if r[1]
        ]
        return {"certifications": all_certs[:6], "labs": []}
    except Exception as e:
        log.error("Recommendations fetch error user %s: %s", user_id, e)
        return {"certifications": [], "labs": []}