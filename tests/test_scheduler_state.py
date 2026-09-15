from datetime import datetime

from dse_collector.scheduler_state import cycle_finished, cycle_started, scheduler_started, snapshot


def test_scheduler_state_tracks_real_cycle_transitions() -> None:
    scheduler_started(10)
    waiting = snapshot(True)
    assert waiting["cycle_status"] == "waiting"
    assert waiting["taskRunning"] is True
    assert waiting["processAwake"] is True
    assert datetime.fromisoformat(str(waiting["next_cycle_at"]))

    cycle_started()
    running = snapshot(True)
    assert running["cycle_status"] == "running"
    assert running["next_cycle_at"] is None
    assert running["last_cycle_started_at"] is not None

    cycle_finished(120)
    finished = snapshot(True)
    assert finished["cycle_status"] == "waiting"
    assert finished["last_cycle_finished_at"] is not None
    assert finished["next_cycle_at"] is not None
    assert finished["last_error"] is None


def test_scheduler_state_preserves_cycle_error() -> None:
    cycle_started()
    cycle_finished(120, "boom")
    state = snapshot(True)
    assert state["cycle_status"] == "error"
    assert state["last_error"] == "boom"
