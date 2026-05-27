from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from services.activity_service import EVENT_CACHE_TTL_SECONDS, ActivityService


def make_event() -> MagicMock:
    event = MagicMock()
    event.id = 1
    event.orgnr = "123456789"
    event.event_type = "accounting_added"
    event.source = "Regnskapsregisteret via Brreg"
    event.source_update_id = "journal-1"
    event.occurred_at = datetime(2025, 12, 31, tzinfo=UTC)
    event.observed_at = datetime(2026, 5, 27, 12, 0, tzinfo=UTC)
    event.previous_value = None
    event.new_value = {"aar": 2025}
    event.payload = {"journalnr": "journal-1"}
    return event


@pytest.mark.asyncio
async def test_get_company_events_shapes_response_and_uses_limit_plus_one():
    service = ActivityService(AsyncMock())
    service.cache = AsyncMock()
    service.cache.get.return_value = None
    service.event_repository = AsyncMock()
    service.event_repository.get_events_for_company.return_value = [make_event()]

    response = await service.get_company_events("123456789", limit=10, offset=5)

    assert response.orgnr == "123456789"
    assert response.limit == 10
    assert response.offset == 5
    assert response.has_more is False
    assert response.events[0].title == "Regnskap lagt til"
    assert response.events[0].time_semantics.startswith("Kildetidspunkt")
    service.event_repository.get_events_for_company.assert_awaited_once_with("123456789", limit=11, offset=5)
    service.cache.set.assert_awaited_once()
    assert service.cache.set.await_args.kwargs["ttl"] == EVENT_CACHE_TTL_SECONDS


@pytest.mark.asyncio
async def test_get_company_events_sets_has_more_from_extra_row():
    service = ActivityService(AsyncMock())
    service.cache = AsyncMock()
    service.cache.get.return_value = None
    service.event_repository = AsyncMock()
    service.event_repository.get_events_for_company.return_value = [make_event(), make_event()]

    response = await service.get_company_events("123456789", limit=1, offset=0)

    assert response.has_more is True
    assert len(response.events) == 1


@pytest.mark.asyncio
async def test_get_overview_includes_event_backed_accounting_feed_when_enabled():
    service = ActivityService(AsyncMock())
    service.event_ledger_enabled = True
    service.cache = AsyncMock()
    service.cache.get.return_value = None
    service.repository = AsyncMock()
    service.repository.get_latest_registered_companies.return_value = []
    service.repository.get_latest_bankruptcies.return_value = []
    service.repository.get_system_state.return_value = []
    service.event_repository = AsyncMock()
    service.event_repository.get_latest_events_by_type_with_company.return_value = [
        {
            "id": 1,
            "orgnr": "123456789",
            "event_type": "accounting_added",
            "source": "Bedriftsgrafen backfill",
            "source_update_id": "regnskap:1",
            "occurred_at": datetime(2025, 12, 31, tzinfo=UTC),
            "observed_at": datetime(2026, 5, 27, 12, 0, tzinfo=UTC),
            "new_value": {"aar": 2025},
            "payload": {},
            "navn": "Test Bedrift AS",
            "organisasjonsform": "AS",
            "naeringskode": "62.010",
            "antall_ansatte": 12,
        }
    ]

    response = await service.get_overview(limit=12)

    assert response.accounting_updates.id == "accounting_updates"
    assert response.accounting_updates.items[0].orgnr == "123456789"
    assert response.accounting_updates.items[0].event_label == "Regnskap 2025 lagt til"
    assert response.deferred_feeds[0].id == "employee_changes"
    service.event_repository.get_latest_events_by_type_with_company.assert_awaited_once_with(
        "accounting_added", limit=12
    )


@pytest.mark.asyncio
async def test_get_overview_skips_accounting_event_query_when_ledger_disabled():
    service = ActivityService(AsyncMock())
    service.event_ledger_enabled = False
    service.cache = AsyncMock()
    service.cache.get.return_value = None
    service.repository = AsyncMock()
    service.repository.get_latest_registered_companies.return_value = []
    service.repository.get_latest_bankruptcies.return_value = []
    service.repository.get_system_state.return_value = []
    service.event_repository = AsyncMock()

    response = await service.get_overview(limit=12)

    assert response.accounting_updates.items == []
    service.event_repository.get_latest_events_by_type_with_company.assert_not_called()
