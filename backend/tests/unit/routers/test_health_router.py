from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from limiter import limiter
from main import app

client = TestClient(app)

# Disable rate limiter
limiter.enabled = False


def test_health_check_returns_200():
    """Test health endpoint returns ok status with dependency info."""
    with (
        patch("routers.health.check_database_health", new_callable=AsyncMock, return_value=True),
        patch("routers.health.check_redis_health", new_callable=AsyncMock, return_value=True),
    ):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["database"] == "connected"
        assert "redis" in data


def test_health_check_shows_redis_unavailable():
    """Test health endpoint shows Redis as unavailable when down."""
    with (
        patch("routers.health.check_database_health", new_callable=AsyncMock, return_value=True),
        patch("routers.health.check_redis_health", new_callable=AsyncMock, return_value=False),
    ):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["redis"] == "unavailable"


def test_liveness_check_returns_200():
    """Test liveness endpoint remains cheap and dependency-free."""
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_check_returns_ready_when_dependencies_are_available():
    """Test readiness endpoint returns 200 when DB and Redis are healthy."""
    with (
        patch("routers.health.check_database_health", new_callable=AsyncMock, return_value=True),
        patch("routers.health.check_redis_health", new_callable=AsyncMock, return_value=True),
    ):
        response = client.get("/health/ready")
        assert response.status_code == 200
        assert response.json()["status"] == "ready"


def test_readiness_check_returns_503_when_dependency_is_unavailable():
    """Test readiness endpoint returns 503 when a dependency is unavailable."""
    with (
        patch("routers.health.check_database_health", new_callable=AsyncMock, return_value=False),
        patch("routers.health.check_redis_health", new_callable=AsyncMock, return_value=True),
    ):
        response = client.get("/health/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not_ready"
        assert data["database"] == "unavailable"
