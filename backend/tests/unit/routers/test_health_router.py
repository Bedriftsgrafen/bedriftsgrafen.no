from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

from main import app
from limiter import limiter

client = TestClient(app)

# Disable rate limiter
limiter.enabled = False


def test_health_check_returns_200():
    """Test health endpoint returns ok status with Redis info."""
    with patch("routers.health.check_redis_health", new_callable=AsyncMock, return_value=True):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "redis" in data


def test_health_check_shows_redis_unavailable():
    """Test health endpoint shows Redis as unavailable when down."""
    with patch("routers.health.check_redis_health", new_callable=AsyncMock, return_value=False):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["redis"] == "unavailable"
