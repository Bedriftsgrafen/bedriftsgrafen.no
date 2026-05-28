import argparse

import pytest

from scripts import replay_brreg_update_events as replay


def make_args(**overrides):
    values = {
        "from_id": 100,
        "from_time": None,
        "to_id": 110,
        "to_time": None,
        "limit": 50,
        "batch_size": 10,
        "preview_limit": 5,
        "apply": False,
        "dry_run": False,
        "api_timeout": 30.0,
    }
    values.update(overrides)
    return argparse.Namespace(**values)


def test_validate_args_requires_bounded_id_order():
    args = make_args(from_id=200, to_id=100)

    with pytest.raises(SystemExit, match="--to-id must be greater"):
        replay.validate_args(args)


def test_validate_args_rejects_apply_and_dry_run_together():
    args = make_args(apply=True, dry_run=True)

    with pytest.raises(SystemExit, match="--apply and --dry-run"):
        replay.validate_args(args)


def test_entity_in_window_stops_after_upper_id_bound():
    args = make_args(from_id=100, to_id=110)

    include, stop = replay.entity_in_window({"oppdateringsid": 111}, args)

    assert include is False
    assert stop is True


def test_classify_company_update_event_types_groups_paths_and_employee_changes():
    entity = {
        "endringstype": "Endring",
        "endringer": [
            {"path": "/forretningsadresse/postnummer", "op": "replace"},
            {"path": "/naeringskode1/kode", "op": "replace"},
            {"path": "/antallAnsatte", "op": "replace"},
            {"path": "/ukjentFelt", "op": "replace"},
        ],
    }

    assert replay.classify_company_update_event_types(entity) == [
        "address_changed",
        "industry_changed",
        "employee_count_changed",
    ]


def test_classify_company_update_event_types_handles_lifecycle_rows():
    assert replay.classify_company_update_event_types({"endringstype": "Ny"}) == ["company_registered"]
    assert replay.classify_company_update_event_types({"endringstype": "Sletting"}) == ["company_deleted"]
    assert replay.classify_company_update_event_types({"endringstype": "Fjernet"}) == ["company_removed_from_open_data"]


def test_build_replay_candidates_skips_rows_without_id_or_orgnr():
    candidates = replay.build_replay_candidates(
        [
            {"oppdateringsid": 100, "organisasjonsnummer": "123456789", "endringstype": "Ny"},
            {"organisasjonsnummer": "123456789", "endringstype": "Ny"},
            {"oppdateringsid": 101, "endringstype": "Ny"},
        ]
    )

    assert len(candidates) == 1
    assert candidates[0].source_update_id == "100"
    assert candidates[0].event_types == ["company_registered"]


def test_build_summary_reports_missing_events_and_preview():
    candidates = [
        replay.ReplayCandidate(
            orgnr="123456789",
            source_update_id="100",
            oppdateringsid=100,
            source_change_type="Endring",
            occurred_at="2026-05-27T12:00:00Z",
            event_types=["address_changed", "employee_count_changed"],
            change_paths=["/forretningsadresse/postnummer", "/antallAnsatte"],
        ),
        replay.ReplayCandidate(
            orgnr="987654321",
            source_update_id="101",
            oppdateringsid=101,
            source_change_type="Ukjent",
            occurred_at="2026-05-27T12:05:00Z",
            event_types=[],
            change_paths=["/ukjentFelt"],
        ),
    ]
    existing_pairs = {("123456789", "address_changed", "100")}

    summary = replay.build_summary(
        mode="dry-run",
        rows=[{}, {}],
        pages_fetched=1,
        candidates=candidates,
        existing_pairs=existing_pairs,
        preview_limit=1,
    )

    assert summary["candidate_events"] == 2
    assert summary["existing_events"] == 1
    assert summary["estimated_missing_events"] == 1
    assert summary["rows_without_candidate_event"] == 1
    assert summary["event_types"] == {"address_changed": 1, "employee_count_changed": 1}
    assert len(summary["preview"]) == 1
