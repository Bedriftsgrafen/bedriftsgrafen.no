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
)
from services.activity_service import ActivityService


@pytest.fixture
def mock_activity_service(monkeypatch):
    service_mock = AsyncMock(spec=ActivityService)
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
