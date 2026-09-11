from __future__ import annotations

from supabase import Client, create_client


class SupabaseStorage:
    def __init__(self, url: str, service_role_key: str) -> None:
        self.client: Client = create_client(url, service_role_key)

    def upsert_quotes(self, rows: list[dict]) -> int:
        if not rows:
            return 0
        self.client.table("dse_market_quotes").upsert(
            rows,
            on_conflict="trade_code,snapshot_at",
        ).execute()
        return len(rows)

    def acquire_lock(self, owner: str, ttl_seconds: int) -> bool:
        response = self.client.rpc(
            "acquire_dse_collector_lock",
            {"p_owner": owner, "p_ttl_seconds": ttl_seconds},
        ).execute()
        return bool(response.data)

    def release_lock(self, owner: str) -> None:
        self.client.rpc(
            "release_dse_collector_lock",
            {"p_owner": owner},
        ).execute()

    def start_run(self, source_url: str, trigger: str = "cron") -> str:
        response = self.client.table("dse_collection_runs").insert(
            {"source_url": source_url, "status": "running", "trigger": trigger}
        ).execute()
        return response.data[0]["id"]

    def finish_run(self, run_id: str, rows_collected: int) -> None:
        self.client.table("dse_collection_runs").update(
            {"status": "success", "rows_collected": rows_collected}
        ).eq("id", run_id).execute()

    def skip_run(self, run_id: str, reason: str) -> None:
        self.client.table("dse_collection_runs").update(
            {"status": "skipped", "error_message": reason[:2000]}
        ).eq("id", run_id).execute()

    def fail_run(self, run_id: str, error_message: str) -> None:
        self.client.table("dse_collection_runs").update(
            {"status": "failed", "error_message": error_message[:2000]}
        ).eq("id", run_id).execute()

    def latest_run(self) -> dict | None:
        response = (
            self.client.table("dse_collection_runs")
            .select("id,status,rows_collected,error_message,started_at,updated_at,trigger")
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def recent_runs(self, limit: int = 50) -> list[dict]:
        response = (
            self.client.table("dse_collection_runs")
            .select("id,status,rows_collected,error_message,started_at,updated_at,trigger")
            .order("started_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data or []

    def latest_quotes(self, limit: int = 1000) -> list[dict]:
        response = (
            self.client.table("dse_market_quotes")
            .select("trade_code,ltp,high,low,close_price,yesterday_close,change,trade_count,value_mn,volume,snapshot_at")
            .order("snapshot_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = response.data or []
        latest: dict[str, dict] = {}
        for row in rows:
            symbol = row.get("trade_code")
            if symbol and symbol not in latest:
                latest[symbol] = row
        return sorted(latest.values(), key=lambda row: row.get("trade_code", ""))

    def quote_history(self, symbol: str, limit: int = 370) -> list[dict]:
        response = (
            self.client.table("dse_market_quotes")
            .select("trade_code,ltp,high,low,close_price,yesterday_close,change,volume,snapshot_at")
            .eq("trade_code", symbol.upper())
            .order("snapshot_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = response.data or []
        rows.reverse()
        return rows

    def symbol_counts(self, limit: int = 5000) -> list[dict]:
        response = (
            self.client.table("dse_market_quotes")
            .select("trade_code,snapshot_at")
            .order("snapshot_at", desc=True)
            .limit(limit)
            .execute()
        )
        stats: dict[str, dict] = {}
        for row in response.data or []:
            symbol = row.get("trade_code")
            if not symbol:
                continue
            item = stats.setdefault(symbol, {"symbol": symbol, "count": 0, "lastUpdated": row.get("snapshot_at")})
            item["count"] += 1
        return sorted(stats.values(), key=lambda item: item["symbol"])
