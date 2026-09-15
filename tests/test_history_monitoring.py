from dse_collector.dashboard import _phase_stats


class FakeStorage:
    def history_monitoring_stats(self, start_date: str, end_date: str) -> list[dict]:
        if start_date == "2026-07-01":
            return [
                {"trade_code": "AAA", "earliest_date": "2026-07-02", "latest_date": "2026-09-15", "row_count": 50},
                {"trade_code": "BBB", "earliest_date": "2026-07-02", "latest_date": "2026-09-15", "row_count": 49},
            ]
        return []


def test_phase_stats_use_aggregates_without_raw_history_rows() -> None:
    phases, coverage, symbols = _phase_stats(FakeStorage(), 395)
    assert len(phases) == 1
    assert phases[0]["symbolsWithData"] == 2
    assert phases[0]["rows"] == 99
    assert phases[0]["startDate"] == "2026-07-02"
    assert len(coverage) == 2
    assert symbols == {"AAA", "BBB"}
