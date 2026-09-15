from datetime import date

from dse_collector.phases import PHASES, archive_floor, available_phases, effective_phase_dates


def test_archive_floor_is_two_calendar_years() -> None:
    assert archive_floor(date(2026, 9, 16)) == date(2024, 9, 16)


def test_phase2_is_clipped_to_archive_floor() -> None:
    phase2 = next(phase for phase in PHASES if phase.id == "phase2")
    assert effective_phase_dates(phase2, date(2026, 9, 16)) == (date(2024, 9, 16), date(2025, 6, 30))


def test_phase3_is_not_exposed_when_fully_unavailable() -> None:
    ids = [phase.id for phase, _, _ in available_phases(date(2026, 9, 16))]
    assert ids == ["current", "phase1", "phase2"]
    assert "phase3" not in ids


def test_current_phase_ends_at_today() -> None:
    current = next(phase for phase in PHASES if phase.id == "current")
    assert effective_phase_dates(current, date(2026, 9, 16)) == (date(2026, 7, 1), date(2026, 9, 16))


def test_future_current_phase_is_hidden_instead_of_inverted() -> None:
    current = next(phase for phase in PHASES if phase.id == "current")
    assert effective_phase_dates(current, date(2026, 6, 30)) is None
