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

    def start_run(self, source_url: str) -> str:
        response = self.client.table("dse_collection_runs").insert(
            {"source_url": source_url, "status": "running"}
        ).execute()
        return response.data[0]["id"]

    def finish_run(self, run_id: str, rows_collected: int) -> None:
        self.client.table("dse_collection_runs").update(
            {"status": "success", "rows_collected": rows_collected}
        ).eq("id", run_id).execute()

    def fail_run(self, run_id: str, error_message: str) -> None:
        self.client.table("dse_collection_runs").update(
            {"status": "failed", "error_message": error_message[:2000]}
        ).eq("id", run_id).execute()
