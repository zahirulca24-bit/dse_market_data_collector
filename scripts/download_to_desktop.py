#!/usr/bin/env python3
"""Download last 2 years of historical price data for selected DSE textile stocks
and save the CSV files on the user's Desktop.

The script uses the public StockNow API (no API key required). It creates a
`DSE_Textile_History` folder on the Desktop and stores one CSV per ticker.
"""

import os
import sys
from datetime import datetime, timedelta
import requests
import pandas as pd

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------
TICKERS = ["SQUARETEXT", "PTL", "ENVOYTEX", "MATINSPINN", "APEXSPINN"]
API_URL = "https://stocknow.com.bd/api/v1/historical"

# Resolve Desktop path (Windows)
desktop = os.path.join(os.path.expanduser("~"), "Desktop")
output_dir = os.path.join(desktop, "DSE_Textile_History")
os.makedirs(output_dir, exist_ok=True)

# Date range – last 2 years (inclusive)
end_date = datetime.today()
start_date = end_date - timedelta(days=2 * 365)
start_str = start_date.strftime("%Y-%m-%d")
end_str = end_date.strftime("%Y-%m-%d")

def fetch(ticker: str) -> pd.DataFrame:
    params = {
        "symbol": ticker,
        "from": start_str,
        "to": end_str,
        "exchange": "DSE",
    }
    resp = requests.get(API_URL, params=params, timeout=20)
    resp.raise_for_status()
    data = resp.json().get("data", [])
    if not data:
        print(f"[WARN] No data returned for {ticker}")
    return pd.DataFrame(data)

def main():
    for sym in TICKERS:
        try:
            df = fetch(sym)
            if df.empty:
                continue
            csv_path = os.path.join(output_dir, f"{sym}_last2y.csv")
            df.to_csv(csv_path, index=False)
            print(f"Saved {sym} -> {csv_path}")
        except Exception as e:
            print(f"[ERROR] Failed for {sym}: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
