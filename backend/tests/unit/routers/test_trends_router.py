import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def mock_db_session(monkeypatch):
    mock_session = AsyncMock()
    # Mock result.all()
    mock_result = MagicMock()
    mock_result.all.return_value = []
    mock_session.execute.return_value = mock_result
    
    # Override get_db dependency
    from database import get_db
    app.dependency_overrides[get_db] = lambda: mock_session
    return mock_session

def test_get_trends_timeline_bankruptcies(client, mock_db_session):
    # Arrange
    mock_row = MagicMock()
    mock_row.month = "2023-01"
    mock_row.count = 50
    
    mock_result = mock_db_session.execute.return_value
    mock_result.all.return_value = [mock_row]
    
    # Act
    response = client.get("/v1/trends/timeline?metric=bankruptcies&months=12")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["month"] == "2023-01"
    assert data[0]["count"] == 50

def test_get_trends_timeline_new_companies(client, mock_db_session):
    # Arrange
    mock_row = MagicMock()
    mock_row.month = "2023-02"
    mock_row.count = 100
    
    mock_result = mock_db_session.execute.return_value
    mock_result.all.return_value = [mock_row]
    
    # Act
    response = client.get("/v1/trends/timeline?metric=new_companies")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data[0]["month"] == "2023-02"
    assert data[0]["count"] == 100

def test_get_trends_timeline_invalid_metric(client, mock_db_session):
    # Act
    response = client.get("/v1/trends/timeline?metric=invalid")
    
    # Assert
    assert response.status_code == 422

def test_get_trends_timeline_invalid_months(client, mock_db_session):
    # Act
    response = client.get("/v1/trends/timeline?metric=bankruptcies&months=100")
    
    # Assert
    assert response.status_code == 422 # Max is 36
