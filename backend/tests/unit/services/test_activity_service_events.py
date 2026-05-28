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
    service.event_repository.get_latest_events_by_type_with_company.side_effect = [
        [
            {
                "id": 1,
                "orgnr": "123456789",
                "event_type": "accounting_added",
                "source": "Bedriftsgrafen backfill",
                "source_update_id": "regnskap:1",
                "occurred_at": datetime(2025, 12, 31, tzinfo=UTC),
                "observed_at": datetime(2026, 5, 27, 12, 0, tzinfo=UTC),
                "previous_value": None,
                "new_value": {"aar": 2025},
                "payload": {},
                "navn": "Test Bedrift AS",
                "organisasjonsform": "AS",
                "naeringskode": "62.010",
                "antall_ansatte": 12,
            }
        ],
        [
            {
                "id": 2,
                "orgnr": "123456789",
                "event_type": "employee_count_changed",
                "source": "Enhetsregisteret via Brreg",
                "source_update_id": "update-1",
                "occurred_at": datetime(2026, 5, 27, 11, 0, tzinfo=UTC),
                "observed_at": datetime(2026, 5, 27, 12, 0, tzinfo=UTC),
                "previous_value": {"antall_ansatte": 10},
                "new_value": {"antall_ansatte": 12},
                "payload": {},
                "navn": "Test Bedrift AS",
                "organisasjonsform": "AS",
                "naeringskode": "62.010",
                "antall_ansatte": 12,
            }
        ],
    ]
    service.event_repository.get_latest_events_by_types_with_company.return_value = [
        {
            "id": 3,
            "orgnr": "123456789",
            "event_type": "industry_changed",
            "source": "Enhetsregisteret via Brreg",
            "source_update_id": "update-2",
            "occurred_at": datetime(2026, 5, 27, 10, 0, tzinfo=UTC),
            "observed_at": datetime(2026, 5, 27, 12, 0, tzinfo=UTC),
            "previous_value": {"naeringskode1": {"kode": "62.010"}},
            "new_value": {"naeringskode1": {"kode": "70.220"}},
            "payload": {"brreg_change_paths": ["/naeringskode1/kode"]},
            "navn": "Test Bedrift AS",
            "organisasjonsform": "AS",
            "naeringskode": "70.220",
            "antall_ansatte": 12,
        }
    ]

    response = await service.get_overview(limit=12)

    assert response.business_changes.id == "business_changes"
    assert response.business_changes.items[0].event_label == "Næringskode 62.010 → 70.220"
    assert response.business_changes.items[0].source == "Enhetsregisteret via Brreg"
    assert response.accounting_updates.id == "accounting_updates"
    assert response.accounting_updates.items[0].orgnr == "123456789"
    assert response.accounting_updates.items[0].event_label == "Regnskap 2025 lagt til"
    assert response.employee_changes.id == "employee_changes"
    assert response.employee_changes.items[0].event_label == "Ansatte 10 → 12"
    assert response.deferred_feeds == []
    assert service.event_repository.get_latest_events_by_type_with_company.await_args_list[0].args == (
        "accounting_added",
    )
    assert service.event_repository.get_latest_events_by_type_with_company.await_args_list[1].args == (
        "employee_count_changed",
    )
    service.event_repository.get_latest_events_by_types_with_company.assert_awaited_once()


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
    assert response.business_changes.items == []
    assert response.employee_changes.items == []
    service.event_repository.get_latest_events_by_type_with_company.assert_not_called()
    service.event_repository.get_latest_events_by_types_with_company.assert_not_called()


@pytest.mark.asyncio
async def test_get_overview_normalizes_status_values_for_public_copy():
    service = ActivityService(AsyncMock())
    service.event_ledger_enabled = False
    service.cache = AsyncMock()
    service.cache.get.return_value = None
    service.repository = AsyncMock()
    service.repository.get_latest_registered_companies.return_value = []
    service.repository.get_latest_bankruptcies.return_value = []
    service.repository.get_system_state.return_value = [
        {
            "key": "company_update_last_sync_date",
            "value": "2026-05-28",
            "updated_at": datetime(2026, 5, 28, 9, 55, tzinfo=UTC),
        },
        {
            "key": "company_update_latest_id",
            "value": "24497871",
            "updated_at": datetime(2026, 5, 28, 9, 55, tzinfo=UTC),
        },
    ]
    service.event_repository = AsyncMock()

    response = await service.get_overview(limit=12)

    assert [item.value for item in response.data_status] == ["Synkronisert", "Synkronisert"]
