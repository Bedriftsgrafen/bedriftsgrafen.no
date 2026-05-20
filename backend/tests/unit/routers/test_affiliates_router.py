from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers.v1.affiliates import router


def _make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client() -> TestClient:
    return TestClient(_make_app())


@pytest.mark.parametrize(
    ("affiliate_id", "env_var"),
    [
        ("tjenestetorget", "TJENESTETORGET_SPORINGSLENKE"),
        ("klikklaan", "KLIKKLAAN_SPORINGSLENKE"),
        ("zensum", "ZENSUM_SPORINGSLENKE"),
    ],
)
def test_affiliate_redirect_uses_expected_env_var(client: TestClient, affiliate_id: str, env_var: str):
    tracking_url = f"https://example.com/{affiliate_id}"

    with patch.dict("os.environ", {env_var: tracking_url}, clear=False):
        response = client.get(f"/v1/affiliates/{affiliate_id}", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"] == tracking_url
    assert response.headers["cache-control"] == "no-store"


def test_affiliate_redirect_returns_404_when_env_var_is_missing(client: TestClient, monkeypatch):
    monkeypatch.setattr("routers.v1.affiliates.ENV_FILE_CANDIDATES", ())

    with patch.dict("os.environ", {"KLIKKLAAN_SPORINGSLENKE": ""}, clear=False):
        response = client.get("/v1/affiliates/klikklaan", follow_redirects=False)

    assert response.status_code == 404


def test_affiliate_redirect_rejects_non_https_urls(client: TestClient):
    with patch.dict("os.environ", {"ZENSUM_SPORINGSLENKE": "http://example.com/zensum"}, clear=False):
        response = client.get("/v1/affiliates/zensum", follow_redirects=False)

    assert response.status_code == 404


def test_affiliate_redirect_can_read_from_env_file(client: TestClient, tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("ZENSUM_SPORINGSLENKE=https://example.com/zensum\n")
    monkeypatch.setattr("routers.v1.affiliates.ENV_FILE_CANDIDATES", (env_file,))

    with patch.dict("os.environ", {"ZENSUM_SPORINGSLENKE": ""}, clear=False):
        response = client.get("/v1/affiliates/zensum", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"] == "https://example.com/zensum"


def test_affiliate_redirect_returns_404_for_unknown_slug(client: TestClient):
    response = client.get("/v1/affiliates/unknown", follow_redirects=False)

    assert response.status_code == 404
