from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _as_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    cron_secret: str
    dse_source_url: str
    http_timeout_seconds: float
    user_agent: str
    market_timezone: str
    market_open: str
    market_close: str
    market_days: tuple[int, ...]
    enforce_market_window: bool
    lock_ttl_seconds: int
    retry_attempts: int
    retry_backoff_seconds: float

    @classmethod
    def from_env(cls) -> "Settings":
        url = os.getenv("SUPABASE_URL", "").strip()
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        cron_secret = os.getenv("CRON_SECRET", "").strip()
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
        if not cron_secret:
            raise RuntimeError("CRON_SECRET is required")

        days = tuple(
            int(value.strip())
            for value in os.getenv("MARKET_DAYS", "6,0,1,2,3").split(",")
            if value.strip()
        )

        return cls(
            supabase_url=url,
            supabase_service_role_key=key,
            cron_secret=cron_secret,
            dse_source_url=os.getenv(
                "DSE_SOURCE_URL",
                "https://www.dsebd.org/latest_share_price_scroll_by_ltp.php",
            ).strip(),
            http_timeout_seconds=float(os.getenv("HTTP_TIMEOUT_SECONDS", "20")),
            user_agent=os.getenv(
                "COLLECTOR_USER_AGENT", "dse-market-data-collector/2.0"
            ).strip(),
            market_timezone=os.getenv("MARKET_TIMEZONE", "Asia/Dhaka").strip(),
            market_open=os.getenv("MARKET_OPEN", "10:00").strip(),
            market_close=os.getenv("MARKET_CLOSE", "14:10").strip(),
            market_days=days,
            enforce_market_window=_as_bool("ENFORCE_MARKET_WINDOW", True),
            lock_ttl_seconds=int(os.getenv("LOCK_TTL_SECONDS", "240")),
            retry_attempts=max(1, int(os.getenv("RETRY_ATTEMPTS", "3"))),
            retry_backoff_seconds=max(0.0, float(os.getenv("RETRY_BACKOFF_SECONDS", "2"))),
        )
