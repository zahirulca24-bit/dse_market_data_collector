from dse_collector.sectors import UNMAPPED_SECTOR, sector_for_symbol


def test_unknown_symbols_are_unmapped_instead_of_guessed() -> None:
    assert sector_for_symbol("BRACBANK") == UNMAPPED_SECTOR
    assert sector_for_symbol("SOMETHINGPHARMA") == UNMAPPED_SECTOR
    assert sector_for_symbol("TESTINS") == UNMAPPED_SECTOR


def test_sector_lookup_normalizes_symbol_input() -> None:
    assert sector_for_symbol(" bracbank ") == UNMAPPED_SECTOR


def test_empty_symbol_is_unmapped() -> None:
    assert sector_for_symbol("") == UNMAPPED_SECTOR
