from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

import models
from repositories.company_event_repository import CompanyEventRepository


def make_event() -> models.CompanyEvent:
    return models.CompanyEvent(
        id=1,
        orgnr="123456789",
        event_type="accounting_added",
        source="Regnskapsregisteret via Brreg",
        source_update_id="journal-1",
        event_key="accounting_added:123456789:stable-key",
        observed_at=datetime(2026, 5, 27, 12, 0, tzinfo=UTC),
    )


def test_build_event_key_is_stable_for_same_input():
    first_key = CompanyEventRepository.build_event_key(
        orgnr="123456789",
        event_type="accounting_added",
        source="Regnskapsregisteret via Brreg",
        source_update_id="journal-1",
        payload={"aar": 2025},
    )
    second_key = CompanyEventRepository.build_event_key(
        orgnr="123456789",
        event_type="accounting_added",
        source="Regnskapsregisteret via Brreg",
        source_update_id="journal-1",
        payload={"aar": 2025},
    )

    assert first_key == second_key
    assert first_key.startswith("accounting_added:123456789:")
    assert len(first_key) < 64


def test_build_event_key_changes_when_source_update_id_changes():
    first_key = CompanyEventRepository.build_event_key(
        orgnr="123456789",
        event_type="accounting_added",
        source="Regnskapsregisteret via Brreg",
        source_update_id="journal-1",
    )
    second_key = CompanyEventRepository.build_event_key(
        orgnr="123456789",
        event_type="accounting_added",
        source="Regnskapsregisteret via Brreg",
        source_update_id="journal-2",
    )

    assert first_key != second_key


@pytest.mark.asyncio
async def test_record_event_returns_inserted_event():
    db = AsyncMock()
    inserted_event = make_event()
    insert_result = MagicMock()
    insert_result.scalar_one_or_none.return_value = inserted_event
    db.execute.return_value = insert_result

    repository = CompanyEventRepository(db)
    result = await repository.record_event(
        orgnr="123456789",
        event_type="accounting_added",
        source="Regnskapsregisteret via Brreg",
        source_update_id="journal-1",
    )

    assert result is inserted_event
    assert db.execute.await_count == 1


@pytest.mark.asyncio
async def test_record_event_returns_existing_event_on_duplicate_key():
    db = AsyncMock()
    existing_event = make_event()
    insert_result = MagicMock()
    insert_result.scalar_one_or_none.return_value = None
    select_result = MagicMock()
    select_result.scalar_one.return_value = existing_event
    db.execute.side_effect = [insert_result, select_result]

    repository = CompanyEventRepository(db)
    result = await repository.record_event(
        orgnr="123456789",
        event_type="accounting_added",
        source="Regnskapsregisteret via Brreg",
        source_update_id="journal-1",
    )

    assert result is existing_event
    assert db.execute.await_count == 2


@pytest.mark.asyncio
async def test_get_events_for_company_returns_ordered_scalars():
    db = AsyncMock()
    event = make_event()
    scalar_result = MagicMock()
    scalar_result.all.return_value = [event]
    execute_result = MagicMock()
    execute_result.scalars.return_value = scalar_result
    db.execute.return_value = execute_result

    repository = CompanyEventRepository(db)
    events = await repository.get_events_for_company("123456789", limit=25, offset=0)

    assert events == [event]
    db.execute.assert_awaited_once()
