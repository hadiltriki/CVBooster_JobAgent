"""
delete_user_jobs.py
-------------------
Supprime tous les jobs de l'utilisateur user_id=3 depuis CosmosDB.

Usage:
    python delete_user_jobs.py
    python delete_user_jobs.py --user_id 5   # pour un autre user
    python delete_user_jobs.py --dry_run      # simulation sans suppression
"""

import argparse
import asyncio
import logging
import os
from dotenv import load_dotenv
from azure.cosmos import CosmosClient, exceptions

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

# ── CosmosDB config (même que database.py) ────────────────────────────────────
COSMOS_ENDPOINT = os.getenv("AZURE_COSMOS_ENDPOINT", "").strip()
COSMOS_KEY      = os.getenv("AZURE_COSMOS_KEY", "").strip()
DB_NAME         = os.getenv("AZURE_COSMOS_DATABASE_NAME", "EduTech_AI_Production")
JOBS_CONTAINER  = os.getenv("AZURE_COSMOS_JOBS_CONTAINER", "AgentSearchJobs")


def get_jobs_container():
    if not COSMOS_ENDPOINT or not COSMOS_KEY:
        raise ValueError("AZURE_COSMOS_ENDPOINT et AZURE_COSMOS_KEY requis dans .env")
    client = CosmosClient(COSMOS_ENDPOINT, credential=COSMOS_KEY)
    db     = client.get_database_client(DB_NAME)
    return db.get_container_client(JOBS_CONTAINER)


def delete_jobs_for_user(user_id: int, dry_run: bool = False) -> dict:
    """
    Supprime tous les documents jobs où user_id correspond.
    Retourne un résumé : total trouvé, supprimés, erreurs.
    """
    container = get_jobs_container()

    # 1. Récupérer tous les jobs de cet utilisateur
    logger.info(f"🔍 Recherche des jobs pour user_id={user_id}...")
    query = "SELECT c.id, c.url, c.title, c.source FROM c WHERE c.user_id=@uid"
    params = [{"name": "@uid", "value": user_id}]

    items = list(container.query_items(
        query=query,
        parameters=params,
        enable_cross_partition_query=True
    ))

    total = len(items)
    logger.info(f"📋 {total} job(s) trouvé(s) pour user_id={user_id}")

    if total == 0:
        logger.info("Aucun job à supprimer.")
        return {"total": 0, "deleted": 0, "errors": 0}

    if dry_run:
        logger.info("🔵 DRY RUN — aucune suppression effectuée. Aperçu :")
        for item in items[:10]:
            logger.info(f"  - [{item.get('source','?')}] {item.get('title','?')[:60]} | id={item['id']}")
        if total > 10:
            logger.info(f"  ... et {total - 10} autres")
        return {"total": total, "deleted": 0, "errors": 0, "dry_run": True}

    # 2. Supprimer un par un (CosmosDB nécessite l'id + partition_key)
    deleted = 0
    errors  = 0

    for item in items:
        doc_id = item["id"]
        # La partition key du container AgentSearchJobs est /url
        # On utilise doc_id comme partition_key fallback si url absent
        partition_key = item.get("url") or doc_id
        try:
            container.delete_item(item=doc_id, partition_key=partition_key)
            deleted += 1
            logger.info(f"  ✅ Supprimé : {item.get('title','?')[:50]} (id={doc_id})")
        except exceptions.CosmosResourceNotFoundError:
            logger.warning(f"  ⚠️  Déjà supprimé : id={doc_id}")
        except Exception as e:
            errors += 1
            logger.error(f"  ❌ Erreur id={doc_id} : {e}")

    logger.info(f"\n📊 Résultat : {deleted}/{total} supprimés | {errors} erreurs")
    return {"total": total, "deleted": deleted, "errors": errors}


def main():
    parser = argparse.ArgumentParser(description="Supprime les jobs d'un utilisateur CosmosDB")
    parser.add_argument("--user_id",  type=int, default=3,    help="ID utilisateur (défaut: 3)")
    parser.add_argument("--dry_run",  action="store_true",    help="Simulation sans suppression")
    args = parser.parse_args()

    print(f"\n{'='*55}")
    print(f"  Suppression jobs — user_id={args.user_id}")
    if args.dry_run:
        print("  MODE: DRY RUN (simulation uniquement)")
    print(f"  DB:   {DB_NAME}")
    print(f"  Cont: {JOBS_CONTAINER}")
    print(f"{'='*55}\n")

    if not args.dry_run:
        confirm = input(f"⚠️  Supprimer TOUS les jobs de user_id={args.user_id} ? (oui/non) : ").strip().lower()
        if confirm not in ("oui", "o", "yes", "y"):
            print("Annulé.")
            return

    result = delete_jobs_for_user(user_id=args.user_id, dry_run=args.dry_run)

    print(f"\n{'='*55}")
    if result.get("dry_run"):
        print(f"  DRY RUN — {result['total']} jobs auraient été supprimés")
    else:
        print(f"  ✅ Terminé — {result['deleted']}/{result['total']} jobs supprimés")
        if result["errors"]:
            print(f"  ❌ {result['errors']} erreur(s)")
    print(f"{'='*55}\n")


if __name__ == "__main__":
    main()