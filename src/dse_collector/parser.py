from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Iterable

from bs4 import BeautifulSoup


_HEADER_MAP = {
    "trading code": "trade_code",
    "trade code": "trade_code",
    "ltp": "ltp",
    "high": "high",
    "low": "low",
    "closep": "close_price",
    "close": "close_price",
    "ycp": "yesterday_close",
    "change": "change",
    "trade": "trade_count",
    "value (mn)": "value_mn",
    "value(mn)": "value_mn",
    "value": "value_mn",
    "volume": "volume",
}


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def _number(value: str) -> Decimal | None:
    value = _clean(value).replace(",", "")
    if value in {"", "-", "--", "N/A", "n/a"}:
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def _integer(value: str) -> int | None:
    number = _number(value)
    return int(number) if number is not None else None


@dataclass(frozen=True)
class MarketQuote:
    trade_code: str
    ltp: Decimal | None
    high: Decimal | None
    low: Decimal | None
    close_price: Decimal | None
    yesterday_close: Decimal | None
    change: Decimal | None
    trade_count: int | None
    value_mn: Decimal | None
    volume: int | None
    snapshot_at: str
    source: str = "dsebd.org"

    def to_record(self) -> dict:
        record = asdict(self)
        for key, value in record.items():
            if isinstance(value, Decimal):
                record[key] = float(value)
        return record


def _normalized_header(cell: str) -> str:
    value = _clean(cell).lower()
    value = value.replace("\n", " ")
    return value


def parse_latest_share_price(html: str, captured_at: datetime | None = None) -> list[MarketQuote]:
    captured_at = captured_at or datetime.now(timezone.utc)
    captured_at = captured_at.replace(second=0, microsecond=0)
    snapshot_at = captured_at.isoformat()

    soup = BeautifulSoup(html, "html.parser")
    candidate_tables = soup.find_all("table")

    for table in candidate_tables:
        rows = table.find_all("tr")
        if not rows:
            continue

        header_cells = rows[0].find_all(["th", "td"])
        headers = [_normalized_header(c.get_text(" ", strip=True)) for c in header_cells]
        mapped = [_HEADER_MAP.get(h) for h in headers]

        if "trade_code" not in mapped or "ltp" not in mapped:
            continue

        quotes: list[MarketQuote] = []
        for row in rows[1:]:
            cells = [_clean(c.get_text(" ", strip=True)) for c in row.find_all("td")]
            if len(cells) < len(headers):
                continue

            values = {
                field: cells[index]
                for index, field in enumerate(mapped)
                if field is not None and index < len(cells)
            }
            trade_code = _clean(values.get("trade_code", "")).upper()
            if not trade_code or trade_code in {"TRADING CODE", "TRADE CODE"}:
                continue

            quotes.append(
                MarketQuote(
                    trade_code=trade_code,
                    ltp=_number(values.get("ltp", "")),
                    high=_number(values.get("high", "")),
                    low=_number(values.get("low", "")),
                    close_price=_number(values.get("close_price", "")),
                    yesterday_close=_number(values.get("yesterday_close", "")),
                    change=_number(values.get("change", "")),
                    trade_count=_integer(values.get("trade_count", "")),
                    value_mn=_number(values.get("value_mn", "")),
                    volume=_integer(values.get("volume", "")),
                    snapshot_at=snapshot_at,
                )
            )

        if quotes:
            return quotes

    raise ValueError("Could not locate the DSE latest-share-price table")


def records(quotes: Iterable[MarketQuote]) -> list[dict]:
    return [quote.to_record() for quote in quotes]
