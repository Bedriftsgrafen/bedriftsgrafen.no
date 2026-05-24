from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_metrics_endpoint_rejects_missing_metrics_token():
    with patch("main.METRICS_TOKEN", "secret-token"):
        response = client.get("/metrics")
        assert response.status_code == 403


def test_metrics_endpoint_rejects_near_miss_metrics_token():
    with patch("main.METRICS_TOKEN", "secret-token"):
        response = client.get("/metrics?key=secret-toke")
        assert response.status_code == 403


def test_metrics_endpoint_accepts_query_key():
    with patch("main.METRICS_TOKEN", "secret-token"):
        response = client.get("/metrics?key=secret-token")
        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"]


def test_metrics_endpoint_accepts_bearer_token():
    with patch("main.METRICS_TOKEN", "secret-token"):
        response = client.get("/metrics", headers={"Authorization": "Bearer secret-token"})
        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"]
