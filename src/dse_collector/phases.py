from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class HistoricalPhase:
    id: str
    label: str
    start: date
    end: date | None = None


PHASES = (
    HistoricalPhase("current", "Current Period", date(2026, 7, 1)),
    HistoricalPhase("phase1", "Phase 1", date(2025, 7, 1), date(2026, 6, 30)),
    HistoricalPhase("phase2", "Phase 2", date(2024, 7, 1), date(2025, 6, 30)),
    HistoricalPhase("phase3", "Phase 3", date(2023, 7, 1), date(2024, 6, 30)),
)


def archive_floor(today: date | None = None) -> date:
    current = today or date.today()
    try:
        return current.replace(year=current.year - 2)
    except ValueError:
        return current.replace(year=current.year - 2, day=28)


def effective_phase_dates(phase: HistoricalPhase, today: date | None = None) -> tuple[date, date] | None:
    current = today or date.today()
    requested_end = phase.end or current
    # A future current-period start must not produce an inverted range.
    if requested_end < phase.start:
        return None

    floor = archive_floor(current)
    if requested_end < floor:
        return None

    effective_start = max(phase.start, floor)
    if effective_start > requested_end:
        return None
    return effective_start, requested_end


def available_phases(today: date | None = None) -> tuple[tuple[HistoricalPhase, date, date], ...]:
    result = []
    for phase in PHASES:
        dates = effective_phase_dates(phase, today)
        if dates is not None:
            result.append((phase, dates[0], dates[1]))
    return tuple(result)
