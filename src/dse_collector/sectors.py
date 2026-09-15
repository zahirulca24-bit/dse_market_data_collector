from __future__ import annotations

# Central registry for sector assignments that have been explicitly verified.
# Do not infer sectors from symbol names. Add entries only after verification
# against an authoritative DSE sector source or an approved sector master.
VERIFIED_SECTOR_BY_SYMBOL: dict[str, str] = {}

UNMAPPED_SECTOR = "Unmapped"


def sector_for_symbol(symbol: str) -> str:
    """Return a verified sector or an explicit unmapped value.

    Sector classification must never be guessed from a trading-code suffix,
    prefix, substring, or company-name pattern.
    """
    normalized = str(symbol or "").strip().upper()
    if not normalized:
        return UNMAPPED_SECTOR
    return VERIFIED_SECTOR_BY_SYMBOL.get(normalized, UNMAPPED_SECTOR)
