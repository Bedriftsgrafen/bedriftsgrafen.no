"""
MECE Unit Tests for v1/people API Router

Test Categories:
1. GET /v1/people/search - Person search endpoint
2. GET /v1/people/roles - Person roles endpoint
3. Request validation - Query parameter validation
4. Response models - Pydantic serialization
"""

import pytest
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient


# Mock dependencies before importing router
@pytest.fixture(autouse=True)
def mock_dependencies():
    """Mock database dependency for all tests."""
    with patch("routers.v1.people.get_db") as mock_get_db:
        mock_session = AsyncMock()
        mock_get_db.return_value = mock_session
        yield mock_session


@pytest.fixture
def client():
    """Create test client with mocked dependencies."""
    from main import app

    return TestClient(app)


# ============================================================================
# Category 1: GET /v1/people/search
# ============================================================================
class TestSearchPeopleEndpoint:
    """Tests for the person search endpoint."""

    @pytest.mark.asyncio
    async def test_search_returns_results(self, client):
        """Returns list of matching persons."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.search_people = AsyncMock(
                return_value=[{"name": "Ola Nordmann", "birthdate": date(1980, 5, 15), "role_count": 3}]
            )

            response = client.get("/v1/people/search?q=Ola")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["name"] == "Ola Nordmann"
            assert data[0]["role_count"] == 3

    @pytest.mark.asyncio
    async def test_search_requires_min_3_chars(self, client):
        """Query must be at least 3 characters."""
        response = client.get("/v1/people/search?q=Ol")

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_search_respects_limit(self, client):
        """Limit parameter controls result count."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.search_people = AsyncMock(return_value=[])

            response = client.get("/v1/people/search?q=TestName&limit=5")

            assert response.status_code == 200
            mock_repo.search_people.assert_called_once()
            call_args = mock_repo.search_people.call_args
            assert call_args.kwargs.get("limit") == 5

    @pytest.mark.asyncio
    async def test_search_limit_max_50(self, client):
        """Limit cannot exceed 50."""
        response = client.get("/v1/people/search?q=TestName&limit=100")

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_search_handles_null_birthdate(self, client):
        """Handles persons without birthdate in response."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.search_people = AsyncMock(
                return_value=[{"name": "Kari Nordmann", "birthdate": None, "role_count": 1}]
            )

            response = client.get("/v1/people/search?q=Kari")

            assert response.status_code == 200
            data = response.json()
            assert data[0]["birthdate"] is None


# ============================================================================
# Category 2: GET /v1/people/roles
# ============================================================================
class TestGetPersonRolesEndpoint:
    """Tests for the person roles endpoint."""

    @pytest.mark.asyncio
    async def test_returns_commercial_roles(self, client):
        """Returns list of commercial roles for person."""
        mock_role = MagicMock()
        mock_role.orgnr = "123456789"
        mock_role.type_kode = "DAGL"
        mock_role.type_beskrivelse = "Daglig leder"
        mock_role.enhet_navn = "Test AS"
        mock_role.fratraadt = False
        mock_role.rekkefoelge = 1

        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_person_commercial_roles = AsyncMock(return_value=[mock_role])

            response = client.get("/v1/people/roles?name=Ola%20Nordmann")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["orgnr"] == "123456789"
            assert data[0]["type_kode"] == "DAGL"
            assert data[0]["fratraadt"] is False

    @pytest.mark.asyncio
    async def test_requires_name_parameter(self, client):
        """Name parameter is required."""
        response = client.get("/v1/people/roles")

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_accepts_birthdate_parameter(self, client):
        """Birthdate parameter is optional and accepted."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_person_commercial_roles = AsyncMock(return_value=[])

            response = client.get("/v1/people/roles?name=Ola&birthdate=1980-05-15")

            assert response.status_code == 200
            mock_repo.get_person_commercial_roles.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_empty_for_unknown_person(self, client):
        """Returns empty list for person with no roles."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_person_commercial_roles = AsyncMock(return_value=[])

            response = client.get("/v1/people/roles?name=Unknown%20Person")

            assert response.status_code == 200
            assert response.json() == []

    @pytest.mark.asyncio
    async def test_handles_null_fields_gracefully(self, client):
        """Handles null role fields with defaults."""
        mock_role = MagicMock()
        mock_role.orgnr = None
        mock_role.type_kode = None
        mock_role.type_beskrivelse = None
        mock_role.enhet_navn = None
        mock_role.fratraadt = None
        mock_role.rekkefoelge = None
        mock_role.company = None

        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_person_commercial_roles = AsyncMock(return_value=[mock_role])

            response = client.get("/v1/people/roles?name=Test")

            assert response.status_code == 200
            data = response.json()
            assert data[0]["orgnr"] == ""
            assert data[0]["type_kode"] == "UKJENT"
            assert data[0]["type_beskrivelse"] == "Ukjent rolle"
            assert data[0]["enhet_navn"] == "Ukjent virksomhet"
            assert data[0]["fratraadt"] is False


# ============================================================================
# Category 3: Response Model Validation
# ============================================================================
class TestResponseModels:
    """Tests for Pydantic response model serialization."""

    def test_person_search_result_model(self):
        """PersonSearchResult model serializes correctly."""
        from routers.v1.people import PersonSearchResult

        result = PersonSearchResult(name="Test Person", birthdate=date(1990, 1, 1), role_count=5)

        assert result.name == "Test Person"
        assert result.birthdate == date(1990, 1, 1)
        assert result.role_count == 5

    def test_person_search_result_allows_null_birthdate(self):
        """PersonSearchResult allows null birthdate."""
        from routers.v1.people import PersonSearchResult

        result = PersonSearchResult(name="Test Person", birthdate=None, role_count=1)

        assert result.birthdate is None

    def test_role_response_model(self):
        """RoleResponse model serializes correctly."""
        from routers.v1.people import RoleResponse

        result = RoleResponse(
            orgnr="123456789",
            type_kode="DAGL",
            type_beskrivelse="Daglig leder",
            enhet_navn="Test AS",
            fratraadt=False,
            rekkefoelge=1,
        )

        assert result.orgnr == "123456789"
        assert result.fratraadt is False
        assert result.rekkefoelge == 1

    def test_role_response_allows_null_rekkefoelge(self):
        """RoleResponse allows null rekkefoelge."""
        from routers.v1.people import RoleResponse

        result = RoleResponse(
            orgnr="123",
            type_kode="STYR",
            type_beskrivelse="Styremedlem",
            enhet_navn="Test",
            fratraadt=True,
            rekkefoelge=None,
        )

        assert result.rekkefoelge is None
