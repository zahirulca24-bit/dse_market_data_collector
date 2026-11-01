import os
import json
import logging
from typing import Any
import httpx

logger = logging.getLogger("dse_collector.agents.gemini_analyzer")

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"


def analyze_stock_with_gemini(
    symbol: str,
    stock_info: dict[str, Any],
    history_slice: list[dict[str, Any]],
    indicators: dict[str, Any],
    custom_api_key: str | None = None,
) -> dict[str, Any]:
    """
    Analyzes the technical structure and momentum of a DSE stock using Google Gemini API.
    Provides actionable swing trading signal, entry zone, target, stop loss, and risk-reward commentary.
    """
    api_key = (custom_api_key or os.getenv("GEMINI_API_KEY", "")).strip()

    # Clean technical snapshot for Gemini prompt
    ltp = stock_info.get("ltp") or 0.0
    change = stock_info.get("change") or 0.0
    volume = stock_info.get("volume") or 0

    recent_candles = history_slice[-15:] if history_slice else []
    candles_summary = [
        f"Date: {c.get('time')} | O: {c.get('open')} | H: {c.get('high')} | L: {c.get('low')} | C: {c.get('close')} | Vol: {c.get('volume')}"
        for c in recent_candles
    ]

    prompt_text = f"""You are a senior quantitative stock market technical analyst specializing in the Dhaka Stock Exchange (DSE), Bangladesh.
Analyze the following technical setup for stock: {symbol}

[CURRENT MARKET DATA]
- Symbol: {symbol}
- Current LTP: ৳{ltp}
- Change: {change:+}
- Today's Volume: {volume:,}

[KEY TECHNICAL INDICATORS]
- EMA 20: ৳{indicators.get('ema20', 'N/A')}
- EMA 50: ৳{indicators.get('ema50', 'N/A')}
- RSI (14): {indicators.get('rsi', 'N/A')}
- MACD Line: {indicators.get('macd', 'N/A')}
- Signal Line: {indicators.get('signal', 'N/A')}
- MACD Histogram: {indicators.get('hist', 'N/A')}
- Support Level: ৳{indicators.get('support', 'N/A')}

[RECENT 15 DAILY CANDLES]
{chr(10).join(candles_summary)}

[DSE RULES CONSTRAINTS]
- DSE operates on T+2 settlement for delivery shares (no intraday shorting).
- All setups must be swing trading oriented (holding period 3 to 10 trading days).

Please return a structured JSON response with the following exact keys:
1. "signal": "STRONG BUY" | "BUY" | "NEUTRAL / HOLD" | "SELL" | "STRONG SELL"
2. "sentiment": "Bullish" | "Neutral" | "Bearish"
3. "confidence_pct": integer 50 to 95
4. "entry_range": string (e.g. "৳234 - ৳237")
5. "target_price": string (e.g. "৳255 (+8.5%)")
6. "stop_loss": string (e.g. "৳226 (-4.2%)")
7. "holding_period": string (e.g. "5 - 10 Trading Days")
8. "summary_bengali": 2-3 sentences concise technical verdict in clear Bengali language.
9. "key_observations": list of 3-4 bullet points in English regarding EMA trend, RSI momentum, and volume activity.
10. "risk_level": "Low" | "Medium" | "High"

Return ONLY valid JSON matching this schema."""

    if not api_key:
        return {
            "status": "needs_key",
            "message": "Gemini API Key is not configured yet. Please provide your API key in the input modal.",
        }

    try:
        url = f"{GEMINI_API_URL}?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt_text}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        }

        with httpx.Client(timeout=25.0) as client:
            resp = client.post(url, json=payload)

        if resp.status_code != 200:
            error_detail = resp.text
            try:
                err_json = resp.json()
                error_detail = err_json.get("error", {}).get("message", error_detail)
            except Exception:
                pass
            return {
                "status": "error",
                "message": f"Gemini API returned error ({resp.status_code}): {error_detail}",
            }

        res_data = resp.json()
        raw_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(raw_text)
        return {
            "status": "success",
            "symbol": symbol,
            "analysis": parsed,
        }

    except Exception as exc:
        logger.exception("Gemini analysis invocation failed")
        return {
            "status": "error",
            "message": f"AI Analysis failed: {str(exc)}",
        }
