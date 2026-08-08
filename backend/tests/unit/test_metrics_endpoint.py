from unittest.mock import patch

import httpx
import pytest
from prometheus_client import REGISTRY

from main import app, metrics_registry


async def _get(path: str, **kwargs) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(path, **kwargs)


@pytest.mark.asyncio
async def test_metrics_endpoint_rejects_missing_metrics_token():
    with patch("main.METRICS_TOKEN", "secret-token"):
        response = await _get("/metrics")
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_metrics_endpoint_rejects_near_miss_metrics_token():
    with patch("main.METRICS_TOKEN", "secret-token"):
        response = await _get("/metrics?key=secret-toke")
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_metrics_endpoint_accepts_query_key():
    with patch("main.METRICS_TOKEN", "secret-token"):
        response = await _get("/metrics?key=secret-token")
        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_metrics_endpoint_accepts_bearer_token():
    with patch("main.METRICS_TOKEN", "secret-token"):
        response = await _get("/metrics", headers={"Authorization": "Bearer secret-token"})
        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"]


def test_metrics_registry_defaults_to_single_process_registry(monkeypatch):
    monkeypatch.delenv("PROMETHEUS_MULTIPROC_DIR", raising=False)
    assert metrics_registry() is REGISTRY


def test_metrics_registry_aggregates_workers_when_multiproc_dir_set(tmp_path, monkeypatch):
    """With several uvicorn workers the export must merge their per-process files."""
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", str(tmp_path))

    registry = metrics_registry()

    assert registry is not REGISTRY
    # A MultiProcessCollector is attached and can be scraped without error.
    assert list(registry.collect()) is not None


@pytest.mark.asyncio
async def test_metrics_endpoint_serves_multiproc_registry(tmp_path, monkeypatch):
    """The endpoint must still scrape cleanly when running in multiprocess mode."""
    monkeypatch.setenv("PROMETHEUS_MULTIPROC_DIR", str(tmp_path))

    with patch("main.METRICS_TOKEN", "secret-token"):
        response = await _get("/metrics?key=secret-token")

    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
