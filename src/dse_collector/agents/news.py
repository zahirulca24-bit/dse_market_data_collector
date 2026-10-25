"""Corporate Disclosures & News Agent (trader-news) for Dhaka Stock Exchange.

Fetches, parses, classifies and scores real-time corporate disclosures,
Price Sensitive Information (PSI), Board Meetings, Dividends, and EPS reports
from Dhaka Stock Exchange.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

CACHE_FILE = os.path.join(os.path.dirname(__file__), "news_cache.json")
CACHE_TTL_SECONDS = 300  # 5 minutes in-memory/disk cache

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
}


def _load_cache() -> Dict[str, Any]:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read news cache: {e}")
    return {"timestamp": 0, "rows": []}


def _save_cache(rows: List[Dict[str, Any]]):
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump({"timestamp": time.time(), "rows": rows}, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Failed to save news cache: {e}")


def fetch_live_disclosures(
    code: Optional[str] = None,
    limit: int = 100,
    force_refresh: bool = False,
) -> List[Dict[str, Any]]:
    """Fetch live corporate disclosures and news from DSE API with fallback caching."""
    cache = _load_cache()
    now = time.time()

    # If general feed and fresh cache, return cached rows
    if not force_refresh and not code and (now - cache.get("timestamp", 0) < CACHE_TTL_SECONDS) and cache.get("rows"):
        return cache["rows"][:limit]

    url = "https://dsebd.org/api/live/news"
    if code:
        url += f"?code={urllib.parse.quote(code.upper())}"

    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            rows = data.get("rows", [])
            
            # Enrich and classify every row
            enriched = [classify_dse_news(r) for r in rows]

            # If this was a general fetch, update cache
            if not code and enriched:
                _save_cache(enriched)

            return enriched[:limit]
    except Exception as e:
        logger.warning(f"Error fetching DSE live news from {url}: {e}")
        # Return cache if available
        if cache.get("rows"):
            if code:
                return [r for r in cache["rows"] if r.get("code") == code.upper()][:limit]
            return cache["rows"][:limit]
        return []


def classify_dse_news(item: Dict[str, Any]) -> Dict[str, Any]:
    """Classify disclosure by category, sentiment, materiality impact, and metrics."""
    summary = str(item.get("summary") or "").strip()
    body = str(item.get("body") or "").strip()
    code = str(item.get("code") or "").strip().upper()
    
    text = (summary + " " + body).lower()
    sum_lower = summary.lower()

    category = "GENERAL_NOTICE"
    sentiment = "NEUTRAL"
    impact = "LOW"
    sentiment_score = 0
    metrics: Dict[str, Any] = {}
    risk_warnings: List[str] = []

    # 1. Categorization
    if any(k in sum_lower for k in ["board meeting", "lr 16(1)", "lr 19(1)"]) or "meeting of the board" in sum_lower:
        category = "BOARD_MEETING"
        impact = "MEDIUM"
        risk_warnings.append("Board meeting scheduled: Expect binary earnings/dividend volatility. Plan stops accordingly.")
    elif any(k in sum_lower for k in ["record date", "agm", "egm", "entitlement", "book closure"]):
        category = "RECORD_DATE_AGM"
        impact = "HIGH"
        risk_warnings.append("Record Date / AGM Notice: Share trading may shift to spot market before record date.")
    elif any(k in sum_lower for k in ["daily nav", "weekly nav", "nav of"]):
        category = "NAV_DISCLOSURE"
        impact = "LOW"
    elif any(k in sum_lower for k in ["dividend", "financials", "q1", "q2", "q3", "half year", "un-audited", "audited"]) or any(k in text for k in ["eps was tk", "cash dividend", "stock dividend"]):
        category = "DIVIDEND_EARNINGS"
        impact = "HIGH"
    elif any(k in text for k in ["commercial operation", "expansion", "contract manufacturing", "agreement with", "approved the plan for", "land purchase", "price sensitive"]):
        category = "PSI_MATERIAL"
        impact = "HIGH"
    elif any(k in text for k in ["query regarding", "abnormal price", "unusual price", "suspension", "spot market", "category change", "downgrade"]):
        category = "REGULATORY_QUERY"
        impact = "HIGH"
        risk_warnings.append("Regulatory query or market intervention flag: Check DSE surveillance notice.")
    elif any(k in text for k in ["credit rating", "crisl", "alpha credit rating", "was rated as"]):
        category = "CREDIT_RATING"
        impact = "MEDIUM"

    # 2. Extract Event Date / Record Date
    meeting_m = re.search(r'(?:held on|scheduled on|on)\s*([a-zA-Z]+\s+\d{1,2},\s*\d{4}|\d{1,2}\.\d{1,2}\.\d{4})', text)
    if meeting_m:
        metrics["event_date"] = meeting_m.group(1).strip()

    rec_date_m = re.search(r'record\s*date[:\s]*([a-zA-Z0-9\.\,\s]{6,20}\d{4})', text)
    if rec_date_m:
        metrics["record_date"] = rec_date_m.group(1).strip()

    # 3. Dividend Extraction
    cash_div = re.search(r'(\d+(?:\.\d+)?)\s*%\s*cash\s*dividend', text)
    if cash_div:
        metrics["cash_dividend_pct"] = float(cash_div.group(1))

    stock_div = re.search(r'(\d+(?:\.\d+)?)\s*%\s*stock\s*dividend', text)
    if stock_div:
        metrics["stock_dividend_pct"] = float(stock_div.group(1))

    # 4. EPS Extraction & Growth
    eps_m = re.search(r'eps\s*(?:was|is)?\s*tk\.?\s*([0-9\.\-]+)\s*as\s*against\s*tk\.?\s*([0-9\.\-]+)', text)
    if eps_m:
        try:
            curr_eps = float(eps_m.group(1))
            prev_eps = float(eps_m.group(2))
            metrics["current_eps"] = curr_eps
            metrics["prev_eps"] = prev_eps
            growth = round(((curr_eps - prev_eps) / abs(prev_eps if prev_eps != 0 else 1.0)) * 100, 2)
            metrics["eps_growth_pct"] = growth
        except Exception:
            pass

    # 5. NAVPS Extraction
    nav_m = re.search(r'nav\s*(?:per share)?\s*(?:was|is)?\s*tk\.?\s*([0-9\.\-]+)', text)
    if nav_m:
        try:
            metrics["navps"] = float(nav_m.group(1))
        except Exception:
            pass

    # 6. Sentiment Scoring
    bullish_signals = [
        "cash dividend", "growth", "increased", "higher as against",
        "profit of tk", "expansion", "re-affirmed", "commercial production",
        "won contract", "agreement with", "positive"
    ]
    bearish_signals = [
        "loss of tk", "loss per share", "decreased", "lower as against",
        "suspension", "penalty", "negative", "decline", "declined",
        "withdrawn", "downgraded", "z-category"
    ]

    b_score = sum(1 for s in bullish_signals if s in text)
    bear_score = sum(1 for s in bearish_signals if s in text)

    # Bonus for metric changes
    if "cash_dividend_pct" in metrics and metrics["cash_dividend_pct"] >= 10.0:
        b_score += 2
    if "eps_growth_pct" in metrics:
        if metrics["eps_growth_pct"] > 5.0:
            b_score += 3
        elif metrics["eps_growth_pct"] < -5.0:
            bear_score += 3

    if b_score > bear_score:
        sentiment = "BULLISH"
        sentiment_score = min(100, 30 + (b_score - bear_score) * 20)
    elif bear_score > b_score:
        sentiment = "BEARISH"
        sentiment_score = max(-100, -30 - (bear_score - b_score) * 20)
    else:
        sentiment = "NEUTRAL"
        sentiment_score = 0

    return {
        "id": item.get("id"),
        "code": code,
        "name": item.get("name") or code,
        "sector": item.get("sector") or "",
        "date": item.get("date") or "",
        "time": item.get("time") or "",
        "filedAt": item.get("filedAt") or "",
        "summary": summary,
        "body": body,
        "category": category,
        "sentiment": sentiment,
        "sentiment_score": sentiment_score,
        "impact_level": impact,
        "metrics": metrics,
        "risk_warnings": risk_warnings,
    }


def get_watchlist_news_feed(
    tickers: Optional[List[str]] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    """Retrieve categorized news feed with ticker coverage and market sentiment overview."""
    all_news = fetch_live_disclosures(limit=200)

    # If tickers not provided, default to active symbols
    if not tickers:
        # Check broker paper holdings and standard top symbols
        tickers = ["SQURPHARMA", "GP", "BATBC", "BEXIMCO", "BRACBANK", "MPETROLEUM", "JANATAINS", "LHBL"]

    upper_tickers = {t.upper() for t in tickers}
    
    ticker_matched = [r for r in all_news if r.get("code") in upper_tickers]
    market_wide = [r for r in all_news if r.get("code") not in upper_tickers][:limit]

    # Overall sentiment distribution
    total_bullish = sum(1 for r in all_news if r["sentiment"] == "BULLISH")
    total_bearish = sum(1 for r in all_news if r["sentiment"] == "BEARISH")
    total_neutral = sum(1 for r in all_news if r["sentiment"] == "NEUTRAL")

    # High impact upcoming catalysts
    catalysts = []
    for r in all_news:
        if r.get("impact_level") in ("HIGH", "MEDIUM") and r.get("category") in ("BOARD_MEETING", "RECORD_DATE_AGM", "DIVIDEND_EARNINGS"):
            catalysts.append({
                "code": r.get("code"),
                "name": r.get("name"),
                "category": r.get("category"),
                "date": r.get("date"),
                "event_date": r.get("metrics", {}).get("event_date") or r.get("metrics", {}).get("record_date") or r.get("date"),
                "summary": r.get("summary"),
                "sentiment": r.get("sentiment"),
                "risk_warning": r.get("risk_warnings", [None])[0] if r.get("risk_warnings") else None,
            })

    return {
        "status": "success",
        "total_disclosures_monitored": len(all_news),
        "sentiment_overview": {
            "bullish_count": total_bullish,
            "bearish_count": total_bearish,
            "neutral_count": total_neutral,
            "net_market_bias": "BULLISH" if total_bullish > total_bearish else ("BEARISH" if total_bearish > total_bullish else "NEUTRAL"),
        },
        "watchlist_tickers": list(upper_tickers),
        "watchlist_news": ticker_matched,
        "market_news": market_wide[:30],
        "upcoming_catalysts": catalysts[:15],
    }


def audit_symbol_disclosures(symbol: str) -> Dict[str, Any]:
    """Deep-dive corporate disclosure audit for an individual DSE security."""
    clean_sym = symbol.strip().upper()
    disclosures = fetch_live_disclosures(code=clean_sym, limit=50)

    if not disclosures:
        # Check in all cached rows
        all_news = fetch_live_disclosures(limit=300)
        disclosures = [r for r in all_news if r.get("code") == clean_sym]

    bullish = [d for d in disclosures if d["sentiment"] == "BULLISH"]
    bearish = [d for d in disclosures if d["sentiment"] == "BEARISH"]
    board_meetings = [d for d in disclosures if d["category"] == "BOARD_MEETING"]
    dividends = [d for d in disclosures if d["category"] == "DIVIDEND_EARNINGS"]

    net_score = 0
    if disclosures:
        net_score = round(sum(d["sentiment_score"] for d in disclosures) / len(disclosures))

    upcoming_risks = []
    for d in disclosures[:5]:
        if d.get("risk_warnings"):
            upcoming_risks.extend(d["risk_warnings"])

    # Actionable trader briefing
    briefing = "No immediate corporate disclosure risks detected."
    if board_meetings:
        briefing = f"⚠️ Caution: Board meeting scheduled ({board_meetings[0].get('metrics', {}).get('event_date', board_meetings[0].get('date'))}). High binary volatility expected."
    elif dividends:
        div_metric = dividends[0].get("metrics", {})
        if "cash_dividend_pct" in div_metric:
            briefing = f"🟢 Recent Dividend: {div_metric['cash_dividend_pct']}% Cash declared. Bullish fundamental catalyst."
        elif "eps_growth_pct" in div_metric:
            briefing = f"📊 EPS Growth: {div_metric['eps_growth_pct']}% vs previous year."

    return {
        "status": "success",
        "symbol": clean_sym,
        "total_disclosures": len(disclosures),
        "net_sentiment": "BULLISH" if net_score > 15 else ("BEARISH" if net_score < -15 else "NEUTRAL"),
        "sentiment_score": net_score,
        "breakdown": {
            "bullish_count": len(bullish),
            "bearish_count": len(bearish),
            "board_meeting_count": len(board_meetings),
            "dividend_earnings_count": len(dividends),
        },
        "actionable_briefing": briefing,
        "risk_warnings": list(set(upcoming_risks)),
        "disclosures": disclosures,
    }
