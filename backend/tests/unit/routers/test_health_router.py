from fastapi.testclient import TestClient
from main import app
from main import limiter

client = TestClient(app)

# Disable rate limiter
limiter.enabled = False


def test_health_check_returns_200():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
