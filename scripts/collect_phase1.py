import os
import sys
import asyncio
from datetime import datetime

sys.path.append('d:/Google Antigravity- 11.09.2026/DSE Market Signal/data collector engin/src')
from dse_collector.historical import fetch_historical_data

async def run():
    symbols = ['BRACBANK', 'GP', 'SQURPHARMA']
    start_date = '2025-07-01'
    end_date = '2026-06-30'
    
    report = []
    
    print("Starting Phase 1 Collection (Reverse Chronological)")
    
    import psycopg2
    from psycopg2.extras import execute_values
    DATABASE_URL = "postgresql://postgres.yjtkkmazejkckmksahtu:ka4ubxOl7QwhSPEB@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    
    for sym in symbols:
        print(f"\nFetching {sym} from {start_date} to {end_date}...")
        try:
            data = fetch_historical_data(sym, start_date, end_date)
            # Validate and filter
            valid_rows = []
            rejected_rows = 0
            for row in data:
                if row.get('close') is not None:
                    valid_rows.append(row)
                else:
                    rejected_rows += 1
            
            if not valid_rows:
                report.append({
                    "symbol": sym,
                    "rows": 0,
                    "earliest": "N/A",
                    "latest": "N/A",
                    "rejected": rejected_rows,
                    "insert_result": "No valid data to insert"
                })
                continue
            
            earliest = valid_rows[-1]['trade_date']
            latest = valid_rows[0]['trade_date']
            
            # Insert data
            insert_query = """
            INSERT INTO public.dse_daily_history (trade_code, trade_date, open, high, low, close, volume, value_mn, source)
            VALUES %s
            ON CONFLICT (trade_code, trade_date) DO UPDATE SET
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                volume = EXCLUDED.volume,
                value_mn = EXCLUDED.value_mn,
                source = EXCLUDED.source
            """
            
            values = [
                (r['trade_code'], r['trade_date'], r['open'], r['high'], r['low'], r['close'], r['volume'], r['value_mn'], r['source'])
                for r in valid_rows
            ]
            
            execute_values(cur, insert_query, values)
            
            # Readback test for this Phase 1 period
            cur.execute("SELECT COUNT(*) FROM public.dse_daily_history WHERE trade_code = %s AND trade_date >= %s AND trade_date <= %s", (sym, start_date, end_date))
            count = cur.fetchone()[0]
            
            insert_result = f"Success (Inserted {len(valid_rows)}, DB Count in range: {count})"
            
            report.append({
                "symbol": sym,
                "rows": len(valid_rows),
                "earliest": earliest,
                "latest": latest,
                "rejected": rejected_rows,
                "duplicates": 0, # Since we use upsert, duplicates are overwritten and resolved implicitly
                "insert_result": insert_result
            })
            
        except Exception as e:
            print(f"Error fetching {sym}: {e}")
            report.append({
                "symbol": sym,
                "rows": 0,
                "earliest": "N/A",
                "latest": "N/A",
                "rejected": 0,
                "duplicates": 0,
                "insert_result": f"Fetch Failed - {e}"
            })
            
    cur.close()
    conn.close()
            
    print("\n--- FINAL REPORT ---")
    for r in report:
        print(f"Symbol: {r['symbol']}")
        print(f"  Rows collected: {r['rows']}")
        print(f"  Earliest Date: {r['earliest']}")
        print(f"  Latest Date: {r['latest']}")
        print(f"  Rejected Rows: {r['rejected']}")
        print(f"  Supabase Insert Result: {r['insert_result']}")

if __name__ == "__main__":
    asyncio.run(run())
