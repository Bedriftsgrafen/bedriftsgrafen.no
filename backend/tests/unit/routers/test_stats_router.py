import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from main import app
from schemas.stats import IndustryStatResponse, GeoStatResponse, GeoAveragesResponse
from services.stats_service import StatsService

@pytest.fixture
def mock_stats_service(monkeypatch):
    service_mock = AsyncMock(spec=StatsService)
    monkeypatch.setattr("routers.v1.stats.StatsService", MagicMock(return_value=service_mock))
    
    # Also mock database dependency to avoid "RuntimeError: Task attached to a different loop"
    # Although mocking the Service class should be enough if the router instantiates it.
    
    # We might need to mock get_db simply so it doesn't try to connect,
    # or just trust TestClient to handle dependency overrides if we did that.
    # But here we assume the router: `service = StatsService(db)`
    return service_mock

@pytest.fixture
def client():
    return TestClient(app)

# We need to mock database execution for the direct DB queries in the router.
# The `v1/stats/industries` endpoint executes a query directly on the DB session:
# `result = await db.execute(query)`
# This means we MUST mock the `db` dependency, not just `StatsService`.

@pytest.fixture
def mock_db_session(monkeypatch):
    mock_session = AsyncMock()
    # Mock result.scalars().all() chain
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result
    
    # Override get_db dependency
    from database import get_db
    app.dependency_overrides[get_db] = lambda: mock_session
    return mock_session

def test_get_industry_stats_success(client, mock_db_session):
    # Arrange
    # Mock the return value of the DB query
    mock_stat = MagicMock()
    mock_stat.nace_division = "62"
    mock_stat.nace_name = "IT-tjenester" # Needed because Pydantic reads this attribute
    mock_stat.company_count = 100
    mock_stat.bankrupt_count = 5
    mock_stat.new_last_year = 10
    mock_stat.bankruptcies_last_year = 2
    
    # IMPORTANT: The router expects `scalars().all()` to return a list of ORM models
    mock_res = mock_db_session.execute.return_value
    mock_res.scalars.return_value.all.return_value = [mock_stat]
    
    # Act
    response = client.get("/v1/stats/industries?sort_by=company_count&limit=10")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["nace_division"] == "62"

def test_get_industry_stats_invalid_sort(client, mock_db_session):
    # Act
    # 'invalid_field' is not in the Literal type definition
    response = client.get("/v1/stats/industries?sort_by=invalid_field")
    
    # Assert
    assert response.status_code == 422 # Validation error

def test_get_industry_stat_detail_success(client, mock_db_session):
    # Arrange
    mock_stat = MagicMock()
    mock_stat.nace_division = "62"
    mock_stat.nace_name = "IT-tjenester"
    mock_stat.company_count = 100
    # Must populate mandatory fields for Pydantic
    mock_stat.bankrupt_count = 0
    mock_stat.new_last_year = 0
    mock_stat.bankruptcies_last_year = 0
    
    mock_res = mock_db_session.execute.return_value
    mock_res.scalar_one_or_none.return_value = mock_stat
    
    # Act
    response = client.get("/v1/stats/industries/62")
    
    # Assert
    assert response.status_code == 200
    assert response.json()["nace_division"] == "62"

def test_get_industry_stat_detail_not_found(client, mock_db_session):
    # Arrange
    mock_res = mock_db_session.execute.return_value
    mock_res.scalar_one_or_none.return_value = None
    
    # Act
    response = client.get("/v1/stats/industries/99")
    
    # Assert
    assert response.status_code == 404

def test_get_geography_stats(client, mock_stats_service):
    # Arrange
    mock_stats_service.get_geography_stats.return_value = [
        GeoStatResponse(
            code="03", 
            name="Oslo", 
            value=1000
        )
    ]
    
    # Act
    response = client.get("/v1/stats/geography?level=county")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["code"] == "03"

def test_get_geography_averages(client, mock_db_session):
    # Arrange
    # The endpoint does quite a bit of SQL query construction logic.
    # It executes multiple queries.
    
    # 1. National total query
    # 2. National count query (if municipality level)
    # 3. County stats query (if county_code provided)
    
    # To mock this effectively without coupling too tightly to implementation details ("call 1 returns X, call 2 returns Y"),
    # we can try to rely on side_effect or just simple return values.
    
    # Let's simplify and assume it returns a scalar logic for the simplest case: level=county
    mock_db_session.execute.return_value.scalar.return_value = 5000 # National total
    
    # Act
    response = client.get("/v1/stats/geography/averages?level=county&metric=company_count")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["national_total"] == 5000
    # National avg = total / 15 (COUNTY_NAMES count)
    # We won't assert exact math but presence of fields
    assert "national_avg" in data

