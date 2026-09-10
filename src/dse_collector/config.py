from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    dse_source_url: str
    http_timeout_seconds: float
    user_agent: str

    @classmethod
    def from_env(cls) -> "Settings":
        url = os.getenv("SUPABASE_URL", "").strip()
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
            )

        return cls(
            supabase_url=url,
            supabase_service_role_key=key,
            dse_source_url=os.getenv(
                "DSE_SOURCE_URL",
                "https://www.dsebd.org/latest_share_price_scroll_by_ltp.php",
            ).strip(),
            http_timeout_seconds=float(os.getenv("HTTP_TIMEOUT_SECONDS", "20")),
            user_agent=os.getenv(
                "COLLECTOR_USER_AGENT", "dse-market-data-collector/1.0"
            ).strip(),
        )
