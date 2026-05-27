from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from schemas.activity import (
    ActivityCompanyItem,
    ActivityDeferredFeed,
    ActivityFeed,
    ActivityOverviewResponse,
    ActivityStatusItem,
    CompanyEventItem,
    CompanyEventListResponse,
)
from services.activity_service import ActivityService


@pytest.fixture
def mock_activity_service(monkeypatch):
    service_mock = AsyncMock(spec=ActivityService)
    service_mock.event_ledger_enabled = True
    monkeypatch.setattr("routers.v1.activity.ActivityService", MagicMock(return_value=service_mock))
    return service_mock


@pytest.fixture
def client():
    return TestClient(app)


def make_activity_response() -> ActivityOverviewResponse:
    item = ActivityCompanyItem(
        orgnr="123456789",
        navn="Test Bedrift AS",
        organisasjonsform="AS",
        naeringskode="62.010",
        antall_ansatte=12,
        event_date=date(2026, 5, 27),
        event_label="Registrert i Enhetsregisteret",
        source="Enhetsregisteret via Brreg",
        time_semantics="Kildedato fra Enhetsregisteret, ikke Bedriftsgrafens importtidspunkt.",
    )

    return ActivityOverviewResponse(
        generated_at=datetime(2026, 5, 27, 14, 30, tzinfo=UTC),
        cache_ttl_seconds=120,
        new_companies=ActivityFeed(
            id="new_companies",
            title="Nye virksomheter",
            description="Nyeste registreringer.",
            source="Enhetsregisteret via Brreg",
            time_label="Registreringsdato",
            items=[item],
        ),
        bankruptcies=ActivityFeed(
            id="bankruptcies",
            title="Konkurser og avvikling",
            description="Nyeste konkurser.",
            source="Enhetsregisteret via Brreg",
            time_label="Konkursdato",
            items=[],
        ),
        data_status=[
            ActivityStatusItem(
                key="company_update_last_sync_date",
                title="Enhetsregisteret",
                description="Siste dato Bedriftsgrafen har synket.",
                value="2026-05-27",
                updated_at=datetime(2026, 5, 27, 14, 4, tzinfo=UTC),
                source="Brreg oppdateringsstrøm",
            )
        ],
        deferred_feeds=[
            ActivityDeferredFeed(
                id="accounting_updates",
                title="Nye regnskap hos Bedriftsgrafen",
                reason="Regnskapstabellen mangler trygg indeks.",
                requirement="Legg til indeks eller eventlogg.",
            )
        ],
    )


def make_event_response() -> CompanyEventListResponse:
    return CompanyEventListResponse(
        generated_at=datetime(2026, 5, 27, 14, 30, tzinfo=UTC),
        cache_ttl_seconds=300,
        orgnr="123456789",
        limit=25,
        offset=0,
        has_more=False,
        events=[
            CompanyEventItem(
                id=1,
                orgnr="123456789",
                event_type="accounting_added",
                title="Regnskap lagt til",
                source="Regnskapsregisteret via Brreg",
                source_update_id="journal-1",
                occurred_at=datetime(2025, 12, 31, tzinfo=UTC),
                observed_at=datetime(2026, 5, 27, 14, 0, tzinfo=UTC),
                time_semantics="Kildetidspunkt når kilden oppgir det; ellers tidspunktet Bedriftsgrafen observerte hendelsen.",
                new_value={"aar": 2025},
            )
        ],
    )


def test_get_activity_overview_success(client, mock_activity_service):
    mock_activity_service.get_overview.return_value = make_activity_response()

    response = client.get("/v1/activity/overview?limit=12")

    assert response.status_code == 200
    data = response.json()
    assert data["new_companies"]["items"][0]["orgnr"] == "123456789"
    assert data["deferred_feeds"][0]["id"] == "accounting_updates"
    mock_activity_service.get_overview.assert_called_once_with(limit=12)


def test_get_activity_overview_rejects_large_limit(client, mock_activity_service):
    response = client.get("/v1/activity/overview?limit=100")

    assert response.status_code == 422
    mock_activity_service.get_overview.assert_not_called()


def test_get_activity_overview_handles_service_error(client, mock_activity_service):
    mock_activity_service.get_overview.side_effect = RuntimeError("database unavailable")

    response = client.get("/v1/activity/overview")

    assert response.status_code == 500
    assert response.json()["detail"] == "Internal server error"


def test_get_company_events_success(client, mock_activity_service):
    mock_activity_service.get_company_events.return_value = make_event_response()

    response = client.get("/v1/activity/events/123456789?limit=25&offset=0")

    assert response.status_code == 200
    data = response.json()
    assert data["orgnr"] == "123456789"
    assert data["events"][0]["event_type"] == "accounting_added"
    mock_activity_service.get_company_events.assert_called_once_with(orgnr="123456789", limit=25, offset=0)


def test_get_company_events_rejects_invalid_orgnr(client, mock_activity_service):
    response = client.get("/v1/activity/events/123")

    assert response.status_code == 422
    mock_activity_service.get_company_events.assert_not_called()


def test_get_company_events_rejects_large_limit(client, mock_activity_service):
    response = client.get("/v1/activity/events/123456789?limit=100")

    assert response.status_code == 422
    mock_activity_service.get_company_events.assert_not_called()


def test_get_company_events_returns_503_when_ledger_disabled(client, mock_activity_service):
    mock_activity_service.event_ledger_enabled = False

    response = client.get("/v1/activity/events/123456789")

    assert response.status_code == 503
    assert response.json()["detail"] == "Event ledger is not enabled"
    mock_activity_service.get_company_events.assert_not_called()


def test_get_company_events_handles_service_error(client, mock_activity_service):
    mock_activity_service.get_company_events.side_effect = RuntimeError("company_events missing")

    response = client.get("/v1/activity/events/123456789")

    assert response.status_code == 500
    assert response.json()["detail"] == "Internal server error"
