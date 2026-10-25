"""Financial Valuation & Analyst Agent (trader-analyst) for Dhaka Stock Exchange.

Evaluates P/E ratios, NAVPS, EPS growth, Graham Number intrinsic valuation,
sector peer benchmarks, and fundamental safety scores for DSE securities.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

CACHE_FILE = os.path.join(os.path.dirname(__file__), "fundamentals_cache.json")
CACHE_TTL_SECONDS = 86400  # 24 hours cache for annual/quarterly fundamentals

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# DSE Sector Median P/E Multiples (Industry Benchmarks)
SECTOR_PE_BENCHMARKS = {
    "Bank": 7.2,
    "Pharmaceuticals & Chemicals": 15.5,
    "Fuel & Power": 10.8,
    "Telecommunication": 14.5,
    "Food & Allied": 18.2,
    "Engineering": 16.0,
    "Cement": 14.2,
    "Textile": 12.5,
    "Information Technology": 22.0,
    "Financial Institutions": 10.5,
    "General Insurance": 13.8,
    "Life Insurance": 15.2,
    "Ceramics Sector": 17.5,
    "Miscellaneous": 16.0,
    "DEFAULT": 12.5,
}

# Curated reference fundamentals for top DSE securities as robust zero-latency fallback
FALLBACK_FUNDAMENTALS: Dict[str, Dict[str, Any]] = {
    "SQURPHARMA": {
        "symbol": "SQURPHARMA",
        "name": "Square Pharmaceuticals PLC",
        "sector": "Pharmaceuticals & Chemicals",
        "category": "A",
        "listing_year": 1995,
        "ltp": 218.9,
        "current_pe": 8.12,
        "trailing_pe": 7.53,
        "eps": 27.04,
        "nav": 157.88,
        "paid_up_capital_mn": 8864.51,
        "market_cap_mn": 194664.64,
        "dividend_yield": 5.22,
        "last_dividend_cash_pct": 110.0,
    },
    "MPETROLEUM": {
        "symbol": "MPETROLEUM",
        "name": "Meghna Petroleum PLC.",
        "sector": "Fuel & Power",
        "category": "A",
        "listing_year": 2007,
        "ltp": 208.6,
        "current_pe": 5.85,
        "trailing_pe": 5.40,
        "eps": 35.60,
        "nav": 204.50,
        "paid_up_capital_mn": 1082.16,
        "market_cap_mn": 22606.35,
        "dividend_yield": 8.15,
        "last_dividend_cash_pct": 170.0,
    },
    "BATBC": {
        "symbol": "BATBC",
        "name": "British American Tobacco Bangladesh",
        "sector": "Food & Allied",
        "category": "A",
        "listing_year": 1977,
        "ltp": 382.4,
        "current_pe": 11.20,
        "trailing_pe": 11.50,
        "eps": 34.12,
        "nav": 104.20,
        "paid_up_capital_mn": 5400.00,
        "market_cap_mn": 206496.00,
        "dividend_yield": 7.85,
        "last_dividend_cash_pct": 300.0,
    },
    "GP": {
        "symbol": "GP",
        "name": "Grameenphone Ltd.",
        "sector": "Telecommunication",
        "category": "A",
        "listing_year": 2009,
        "ltp": 278.5,
        "current_pe": 11.45,
        "trailing_pe": 11.80,
        "eps": 24.32,
        "nav": 48.60,
        "paid_up_capital_mn": 13503.00,
        "market_cap_mn": 376058.55,
        "dividend_yield": 7.90,
        "last_dividend_cash_pct": 220.0,
    },
    "BRACBANK": {
        "symbol": "BRACBANK",
        "name": "BRAC Bank PLC",
        "sector": "Bank",
        "category": "A",
        "listing_year": 2007,
        "ltp": 62.4,
        "current_pe": 7.80,
        "trailing_pe": 8.10,
        "eps": 8.00,
        "nav": 44.50,
        "paid_up_capital_mn": 16088.29,
        "market_cap_mn": 100390.93,
        "dividend_yield": 4.01,
        "last_dividend_cash_pct": 25.0,
    },
    "JANATAINS": {
        "symbol": "JANATAINS",
        "name": "Janata Insurance PLC",
        "sector": "General Insurance",
        "category": "A",
        "listing_year": 1994,
        "ltp": 24.5,
        "current_pe": 16.55,
        "trailing_pe": 15.80,
        "eps": 1.48,
        "nav": 14.85,
        "paid_up_capital_mn": 483.96,
        "market_cap_mn": 1185.70,
        "dividend_yield": 4.49,
        "last_dividend_cash_pct": 11.0,
    },
    "LHBL": {
        "symbol": "LHBL",
        "name": "LafargeHolcim Bangladesh Limited",
        "sector": "Cement",
        "category": "A",
        "listing_year": 2003,
        "ltp": 61.2,
        "current_pe": 11.80,
        "trailing_pe": 12.10,
        "eps": 5.18,
        "nav": 19.80,
        "paid_up_capital_mn": 11613.74,
        "market_cap_mn": 71076.09,
        "dividend_yield": 6.54,
        "last_dividend_cash_pct": 40.0,
    },
    "BEXIMCO": {
        "symbol": "BEXIMCO",
        "name": "Bangladesh Export Import Company Ltd.",
        "sector": "Miscellaneous",
        "category": "A",
        "listing_year": 1989,
        "ltp": 115.6,
        "current_pe": 28.50,
        "trailing_pe": 26.80,
        "eps": 4.05,
        "nav": 96.20,
        "paid_up_capital_mn": 8945.74,
        "market_cap_mn": 103412.75,
        "dividend_yield": 2.16,
        "last_dividend_cash_pct": 25.0,
    },
}


def _load_cache() -> Dict[str, Any]:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read fundamentals cache: {e}")
    return {}


def _save_cache(data: Dict[str, Any]):
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Failed to save fundamentals cache: {e}")


def fetch_company_fundamentals(symbol: str, force_refresh: bool = False) -> Dict[str, Any]:
    """Scrapes company fundamentals from DSE with fallback caching and reference tables."""
    clean_sym = symbol.strip().upper()
    cache = _load_cache()
    now = time.time()

    if not force_refresh and clean_sym in cache:
        item = cache[clean_sym]
        if now - item.get("cached_at", 0) < CACHE_TTL_SECONDS:
            return item.get("data", {})

    url = f"https://old.dsebd.org/displayCompany.php?name={clean_sym}"
    parsed_data: Dict[str, Any] = {"symbol": clean_sym}

    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            soup = BeautifulSoup(html, "html.parser")

            # Basic profile info
            for tr in soup.find_all("tr"):
                tds = tr.find_all(["td", "th"])
                if len(tds) >= 2:
                    for i in range(len(tds) - 1):
                        k = tds[i].get_text(strip=True)
                        v = tds[i + 1].get_text(strip=True)
                        if "Last Trading Price" in k:
                            try: parsed_data["ltp"] = float(v.replace(",", ""))
                            except: pass
                        elif "Sector" in k and "sector" not in parsed_data:
                            parsed_data["sector"] = v
                        elif "Market Category" in k:
                            parsed_data["category"] = v
                        elif "Paid-up Capital" in k:
                            try: parsed_data["paid_up_capital_mn"] = float(v.replace(",", ""))
                            except: pass
                        elif "Market Capitalization" in k:
                            try: parsed_data["market_cap_mn"] = float(v.replace(",", ""))
                            except: pass
                        elif "Current P/E Ratio" in k and "current_pe" not in parsed_data:
                            try: parsed_data["current_pe"] = float(v.replace(",", ""))
                            except: pass
                        elif "Trailing P/E Ratio" in k and "trailing_pe" not in parsed_data:
                            try: parsed_data["trailing_pe"] = float(v.replace(",", ""))
                            except: pass

            # Financial Table (Annual audited EPS, NAV)
            history = []
            for tr in soup.find_all("tr"):
                cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
                if len(cells) >= 8 and re.match(r"^20\d\d$", cells[0]):
                    year = cells[0]
                    nums = []
                    for c in cells[1:]:
                        clean = c.replace(",", "")
                        try: nums.append(float(clean))
                        except: pass
                    if len(nums) >= 2:
                        eps_cand = nums[0] if nums[0] < 100 else nums[1]
                        nav_cand = [n for n in nums if n > 10 and n < 1000]
                        history.append({
                            "year": year,
                            "eps": eps_cand,
                            "nav": nav_cand[0] if nav_cand else None,
                        })

            if history:
                parsed_data["history"] = history
                latest = history[-1]
                parsed_data["eps"] = latest.get("eps")
                parsed_data["nav"] = latest.get("nav")

    except Exception as e:
        logger.warning(f"Could not scrape {clean_sym} from DSE: {e}")

    # Fallback to curated reference data if fields are missing
    ref = FALLBACK_FUNDAMENTALS.get(clean_sym, {})
    for key, val in ref.items():
        if key not in parsed_data or parsed_data[key] is None or parsed_data[key] == "":
            parsed_data[key] = val

    # Set default values if still missing
    if "sector" not in parsed_data:
        parsed_data["sector"] = "Miscellaneous"
    if "category" not in parsed_data:
        parsed_data["category"] = "A"
    if "eps" not in parsed_data or parsed_data["eps"] is None:
        parsed_data["eps"] = round(parsed_data.get("ltp", 50.0) / max(parsed_data.get("current_pe", 12.0), 1.0), 2)
    if "nav" not in parsed_data or parsed_data["nav"] is None:
        parsed_data["nav"] = round(parsed_data.get("ltp", 50.0) * 0.7, 2)
    if "current_pe" not in parsed_data or parsed_data["current_pe"] is None:
        parsed_data["current_pe"] = round(parsed_data.get("ltp", 50.0) / max(parsed_data.get("eps", 1.0), 0.1), 2)

    # Save into cache
    cache[clean_sym] = {"cached_at": now, "data": parsed_data}
    _save_cache(cache)

    return parsed_data


def evaluate_company_valuation(symbol: str) -> Dict[str, Any]:
    """Computes Graham Number, Sector P/E comparison, P/B ratio, and Fundamental Health Score."""
    fund = fetch_company_fundamentals(symbol)
    clean_sym = symbol.strip().upper()

    ltp = float(fund.get("ltp") or 100.0)
    eps = float(fund.get("eps") or 5.0)
    nav = float(fund.get("nav") or 50.0)
    pe = float(fund.get("current_pe") or 12.0)
    sector = fund.get("sector", "Miscellaneous")
    category = fund.get("category", "A")

    # 1. Price-to-Book (P/B) Ratio
    pb_ratio = round(ltp / max(nav, 0.01), 2)

    # 2. Sector Median P/E and Discount/Premium
    sector_pe = SECTOR_PE_BENCHMARKS.get(sector, SECTOR_PE_BENCHMARKS["DEFAULT"])
    pe_discount_pct = round(((sector_pe - pe) / sector_pe) * 100, 1)

    # 3. Benjamin Graham Intrinsic Number: sqrt(22.5 * EPS * NAV)
    graham_number = None
    graham_upside_pct = 0.0
    if eps > 0 and nav > 0:
        graham_number = round(math.sqrt(22.5 * eps * nav), 2)
        graham_upside_pct = round(((graham_number - ltp) / ltp) * 100, 1)

    # 4. Fundamental Health & Safety Score (0 - 100)
    score = 0
    # Low P/E multiple (up to 25 pts)
    if pe <= 10.0: score += 25
    elif pe <= 15.0: score += 20
    elif pe <= 22.0: score += 12
    elif pe <= 30.0: score += 5

    # Price to Book cushion (up to 25 pts)
    if pb_ratio <= 1.0: score += 25  # Trading below NAV!
    elif pb_ratio <= 1.5: score += 20
    elif pb_ratio <= 2.5: score += 12
    elif pb_ratio <= 4.0: score += 5

    # Profitability / EPS magnitude (up to 25 pts)
    if eps >= 15.0: score += 25
    elif eps >= 5.0: score += 20
    elif eps > 1.0: score += 12
    elif eps > 0: score += 5

    # Category and Dividend stability (up to 25 pts)
    if category == "A": score += 15
    elif category == "B": score += 8
    div_yield = fund.get("dividend_yield", 0.0)
    if div_yield >= 5.0: score += 10
    elif div_yield >= 2.0: score += 5

    score = min(100, max(0, score))

    # 5. Fundamental Safety Verdict
    if score >= 75 or (pe <= 11.0 and pb_ratio <= 1.8 and graham_upside_pct > 15.0):
        verdict = "UNDERVALUED"
        badge_label = "Deep Value / Strong Margin of Safety"
        badge_color = "emerald"
    elif score >= 50 or (pe <= 22.0 and pb_ratio <= 3.0):
        verdict = "FAIRLY_VALUED"
        badge_label = "Fair Valuation Band"
        badge_color = "amber"
    else:
        verdict = "OVERVALUED"
        badge_label = "Stretched Multiples / Speculative Risk"
        badge_color = "rose"

    # 6. Actionable Analyst Briefing for day/swing traders
    briefing = (
        f"{clean_sym} ({sector}) trades at P/E {pe:.1f}x vs Sector Median {sector_pe:.1f}x "
        f"({abs(pe_discount_pct):.0f}% {'discount' if pe_discount_pct >= 0 else 'premium'}). "
        f"NAV is ৳{nav:.2f} (P/B {pb_ratio:.2f}x). "
    )
    if graham_number:
        briefing += (
            f"Graham intrinsic fair value is ৳{graham_number:.2f} "
            f"({graham_upside_pct:+.1f}% vs LTP ৳{ltp:.2f}). "
        )
    if verdict == "UNDERVALUED":
        briefing += "🟢 Strong fundamental support: Breakout setups carry low downside risk from institutional valuation floors."
    elif verdict == "FAIRLY_VALUED":
        briefing += "🟡 Normal valuation: Rely primarily on technical entry/exit triggers and trailing stops."
    else:
        briefing += "🔴 High valuation multiple: Avoid holding through earnings gaps; keep tight stop-losses."

    return {
        "status": "success",
        "symbol": clean_sym,
        "name": fund.get("name", clean_sym),
        "sector": sector,
        "category": category,
        "listing_year": fund.get("listing_year"),
        "ltp": ltp,
        "metrics": {
            "current_pe": pe,
            "trailing_pe": fund.get("trailing_pe", pe),
            "sector_median_pe": sector_pe,
            "pe_discount_vs_sector_pct": pe_discount_pct,
            "eps": eps,
            "nav_per_share": nav,
            "pb_ratio": pb_ratio,
            "graham_number": graham_number,
            "graham_upside_pct": graham_upside_pct,
            "paid_up_capital_mn": fund.get("paid_up_capital_mn"),
            "market_cap_mn": fund.get("market_cap_mn"),
            "dividend_yield": fund.get("dividend_yield"),
            "last_dividend_cash_pct": fund.get("last_dividend_cash_pct"),
        },
        "valuation": {
            "fundamental_health_score": score,
            "verdict": verdict,
            "badge_label": badge_label,
            "badge_color": badge_color,
            "actionable_briefing": briefing,
        },
        "history": fund.get("history", []),
    }


def evaluate_watchlist_valuations(symbols: Optional[List[str]] = None) -> Dict[str, Any]:
    """Evaluates valuation and fundamental safety scores for a basket of DSE watchlist securities."""
    if not symbols:
        # Defaults to top active symbols + watchlist candidates
        symbols = ["SQURPHARMA", "MPETROLEUM", "BATBC", "GP", "BRACBANK", "JANATAINS", "LHBL", "BEXIMCO"]

    evaluations = [evaluate_company_valuation(sym) for sym in symbols]

    undervalued_count = sum(1 for e in evaluations if e["valuation"]["verdict"] == "UNDERVALUED")
    fair_count = sum(1 for e in evaluations if e["valuation"]["verdict"] == "FAIRLY_VALUED")
    overvalued_count = sum(1 for e in evaluations if e["valuation"]["verdict"] == "OVERVALUED")

    avg_score = round(sum(e["valuation"]["fundamental_health_score"] for e in evaluations) / max(len(evaluations), 1))
    avg_pe = round(sum(e["metrics"]["current_pe"] for e in evaluations) / max(len(evaluations), 1), 1)

    return {
        "status": "success",
        "watchlist_count": len(evaluations),
        "summary": {
            "undervalued_count": undervalued_count,
            "fair_count": fair_count,
            "overvalued_count": overvalued_count,
            "average_fundamental_score": avg_score,
            "average_pe": avg_pe,
        },
        "sector_benchmarks": SECTOR_PE_BENCHMARKS,
        "evaluations": evaluations,
    }
