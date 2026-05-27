from models.accounting import Accounting


def test_accounting_source_metadata_from_raw_data() -> None:
    accounting = Accounting(raw_data={"id": 6336399, "journalnr": "2025764275"})

    assert accounting.source_id == "6336399"
    assert accounting.journalnr == "2025764275"


def test_accounting_source_metadata_handles_missing_raw_data() -> None:
    accounting = Accounting(raw_data=None)

    assert accounting.source_id is None
    assert accounting.journalnr is None
