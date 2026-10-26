#!/usr/bin/env python3
"""Download last 2 years of OHLCV data for selected DSE textile stocks
and store each ticker's CSV under:
E:\dse_market_data_collector_FIXED\DSE_2Years_OHLCV_Data\by_symbol\

The script scrapes the public DSE website (https://dsebd.org) – no API key required.
If the site layout changes, a small edit in the `parse_historical` function may be needed.
"""

import os, sys, time
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup
import pandas as pd

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
TICKERS = ["SQUARETEXT", "PTL", "ENVOYTEX", "MATINSPINN", "APEXSPINN"]
BASE_URL = "https://dsebd.org/displayCompany.php?name={ticker}"
RETRY_COUNT = 3
RETRY_DELAY = 2  # seconds

# Output folder (as requested by the user)
OUT_ROOT = r"E:\dse_market_data_collector_FIXED\DSE_2Years_OHLCV_Data\by_symbol"
os.makedirs(OUT_ROOT, exist_ok=True)

# Date range – last 2 years (inclusive)
end_dt = datetime.today()
start_dt = end_dt - timedelta(days=2 * 365)
start_str = start_dt.strftime("%Y-%m-%d")
end_str = end_dt.strftime("%Y-%m-%d")

def fetch_page(ticker: str) -> str:
    url = BASE_URL.format(ticker=ticker)
    for attempt in range(RETRY_COUNT):
        try:
            resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            if attempt < RETRY_COUNT - 1:
                time.sleep(RETRY_DELAY)
                continue
            raise RuntimeError(f"Failed to fetch page for {ticker}: {e}")

def parse_historical(html: str) -> pd.DataFrame:
    """Extract the historical price table from the DSE company page.
    Expected columns (in order): Date, Open, High, Low, Close, Volume.
    Returns a DataFrame filtered to the global start/end range.
    """
    soup = BeautifulSoup(html, "html.parser")
    # The historical table usually has class "tblData" – adjust if site changes.
    table = soup.find("table", {"class": "tblData"})
    if not table:
        raise ValueError("Historical data table not found on the page")
    rows = table.find_all("tr")
    records = []
    for tr in rows[1:]:  # skip header row
        cols = [c.get_text(strip=True) for c in tr.find_all("td")]
        if len(cols) < 6:
            continue
        # Date format on DSE is typically "dd-MMM-yyyy" (e.g., 27-Oct-2026)
        try:
            dt = datetime.strptime(cols[0], "%d-%b-%Y").date()
        except Exception:
            # fallback ISO format
            try:
                dt = datetime.strptime(cols[0], "%Y-%m-%d").date()
            except Exception:
                continue
        record = {
            "Date": dt.isoformat(),
            "Open": cols[1].replace(",", ""),
            "High": cols[2].replace(",", ""),
            "Low":  cols[3].replace(",", ""),
            "Close": cols[4].replace(",", ""),
            "Volume": cols[5].replace(",", ""),
        }
        records.append(record)
    df = pd.DataFrame(records)
    # Filter to the last‑2‑year window
    mask = (df["Date"] >= start_str) & (df["Date"] <= end_str)
    return df.loc[mask].sort_values("Date")

def main():
    for ticker in TICKERS:
        try:
            html = fetch_page(ticker)
            df = parse_historical(html)
            if df.empty:
                print(f"[WARN] No data for {ticker} in the last 2 years")
                continue
            out_path = os.path.join(OUT_ROOT, f"{ticker}.csv")
            df.to_csv(out_path, index=False)
            print(f"[OK] Saved {ticker} → {out_path} ({len(df)} rows)")
        except Exception as err:
            print(f"[ERROR] {ticker}: {err}", file=sys.stderr)

if __name__ == "__main__":
    main()
