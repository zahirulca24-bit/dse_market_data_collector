from __future__ import annotations

import logging
import sys

import httpx

from .config import Settings
from .parser import parse_latest_share_price, records
from .storage import SupabaseStorage

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("dse_collector")


def collect_once() -> int:
    settings = Settings.from_env()
    storage = SupabaseStorage(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )

    run_id = storage.start_run(settings.dse_source_url)
    try:
        with httpx.Client(
            timeout=settings.http_timeout_seconds,
            follow_redirects=True,
            headers={
                "User-Agent": settings.user_agent,
                "Accept": "text/html,application/xhtml+xml",
            },
        ) as client:
            response = client.get(settings.dse_source_url)
            response.raise_for_status()

        quotes = parse_latest_share_price(response.text)
        count = storage.upsert_quotes(records(quotes))
        storage.finish_run(run_id, count)
        logger.info("Collected and stored %s market quotes", count)
        return count
    except Exception as exc:
        logger.exception("Collector run failed")
        try:
            storage.fail_run(run_id, str(exc))
        except Exception:
            logger.exception("Failed to record collector error in Supabase")
        raise


def main() -> None:
    try:
        collect_once()
    except Exception:
        sys.exit(1)


if __name__ == "__main__":
    main()
