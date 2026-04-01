"""
MECE Unit Tests for v1/people API Router

Test Categories:
1. GET /v1/people/search - Person search endpoint
2. GET /v1/people/roles - Person roles endpoint
3. Request validation - Query parameter validation
4. Response models - Pydantic serialization
"""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
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
        mock_role.foedselsdato = date(1980, 5, 15)

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
        mock_role.foedselsdato = None
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
        from schemas.people import PersonSearchResult

        result = PersonSearchResult(name="Test Person", birthdate=date(1990, 1, 1), role_count=5)

        assert result.name == "Test Person"
        assert result.birthdate == date(1990, 1, 1)
        assert result.role_count == 5

    def test_person_search_result_allows_null_birthdate(self):
        """PersonSearchResult allows null birthdate."""
        from schemas.people import PersonSearchResult

        result = PersonSearchResult(name="Test Person", birthdate=None, role_count=1)

        assert result.birthdate is None

    def test_role_response_model(self):
        """PersonRoleResponse model serializes correctly."""
        from schemas.people import PersonRoleResponse

        result = PersonRoleResponse(
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
        """PersonRoleResponse allows null rekkefoelge."""
        from schemas.people import PersonRoleResponse

        result = PersonRoleResponse(
            orgnr="123",
            type_kode="STYR",
            type_beskrivelse="Styremedlem",
            enhet_navn="Test",
            fratraadt=True,
            rekkefoelge=None,
        )

        assert result.rekkefoelge is None


# ============================================================================
# Category 4: Birthdate Param Parsing (Hotfix 0 — GDPR)
# ============================================================================
class TestBirthdateParamParsing:
    """Tests for year-only and full-date birthdate parsing in /roles endpoint."""

    @pytest.fixture(autouse=True)
    def _mock_is_admin(self):
        """Ensure is_admin returns False regardless of ADMIN_API_KEY env."""
        with patch("routers.v1.people.is_admin", return_value=False):
            yield

    @pytest.mark.asyncio
    async def test_year_only_passes_birthyear(self, client):
        """Year-only birthdate (e.g. '1996') is parsed as birthyear int."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_person_commercial_roles = AsyncMock(return_value=[])

            response = client.get("/v1/people/roles?name=Ola&birthdate=1996")

            assert response.status_code == 200
            mock_repo.get_person_commercial_roles.assert_called_once_with(
                "Ola", birthdate=None, birthyear=1996, include_all=False
            )

    @pytest.mark.asyncio
    async def test_full_date_passes_birthdate(self, client):
        """Full ISO date (e.g. '1996-03-12') is parsed as date object."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_person_commercial_roles = AsyncMock(return_value=[])

            response = client.get("/v1/people/roles?name=Ola&birthdate=1996-03-12")

            assert response.status_code == 200
            mock_repo.get_person_commercial_roles.assert_called_once_with(
                "Ola", birthdate=date(1996, 3, 12), birthyear=None, include_all=False
            )

    @pytest.mark.asyncio
    async def test_none_passes_no_filter(self, client):
        """No birthdate param passes None for both."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_person_commercial_roles = AsyncMock(return_value=[])

            response = client.get("/v1/people/roles?name=Ola")

            assert response.status_code == 200
            mock_repo.get_person_commercial_roles.assert_called_once_with(
                "Ola", birthdate=None, birthyear=None, include_all=False
            )

    @pytest.mark.asyncio
    async def test_unknown_passes_no_filter(self, client):
        """'unknown' birthdate is treated as None (no filter)."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_person_commercial_roles = AsyncMock(return_value=[])

            response = client.get("/v1/people/roles?name=Ola&birthdate=unknown")

            assert response.status_code == 200
            mock_repo.get_person_commercial_roles.assert_called_once_with(
                "Ola", birthdate=None, birthyear=None, include_all=False
            )


# ============================================================================
# Category 5: Response includes foedselsdato (Fix 3 — GDPR disambiguation)
# ============================================================================
class TestFoedselsdatoInResponse:
    """Tests for foedselsdato field in PersonRoleResponse."""

    @pytest.mark.asyncio
    async def test_response_includes_foedselsdato(self, client):
        """PersonRoleResponse includes foedselsdato for disambiguation."""
        mock_role = MagicMock()
        mock_role.orgnr = "123456789"
        mock_role.type_kode = "DAGL"
        mock_role.type_beskrivelse = "Daglig leder"
        mock_role.enhet_navn = "Test AS"
        mock_role.fratraadt = False
        mock_role.rekkefoelge = 1
        mock_role.foedselsdato = date(1996, 3, 12)

        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_person_commercial_roles = AsyncMock(return_value=[mock_role])

            response = client.get("/v1/people/roles?name=Ola&birthdate=1996")

            assert response.status_code == 200
            data = response.json()
            assert data[0]["foedselsdato"] == "1996-03-12"

    @pytest.mark.asyncio
    async def test_response_allows_null_foedselsdato(self, client):
        """PersonRoleResponse handles null foedselsdato."""
        mock_role = MagicMock()
        mock_role.orgnr = "123456789"
        mock_role.type_kode = "DAGL"
        mock_role.type_beskrivelse = "Daglig leder"
        mock_role.enhet_navn = "Test AS"
        mock_role.fratraadt = False
        mock_role.rekkefoelge = 1
        mock_role.foedselsdato = None

        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_person_commercial_roles = AsyncMock(return_value=[mock_role])

            response = client.get("/v1/people/roles?name=Ola")

            assert response.status_code == 200
            data = response.json()
            assert data[0]["foedselsdato"] is None

    def test_schema_includes_foedselsdato(self):
        """PersonRoleResponse schema accepts foedselsdato."""
        from schemas.people import PersonRoleResponse

        result = PersonRoleResponse(
            orgnr="123",
            type_kode="DAGL",
            type_beskrivelse="Daglig leder",
            enhet_navn="Test",
            fratraadt=False,
            rekkefoelge=1,
            foedselsdato=date(1996, 3, 12),
        )
        assert result.foedselsdato == date(1996, 3, 12)


# ============================================================================
# Category 5: GET /v1/people/search/results (NEW)
# ============================================================================
class TestSearchPeopleResultsEndpoint:
    """Tests for the paginated person search results endpoint."""

    @pytest.mark.asyncio
    async def test_returns_paginated_results(self, client):
        """Returns enriched person results with pagination metadata."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.search_people_detailed = AsyncMock(
                return_value=[
                    {
                        "name": "Ola Nordmann",
                        "birthdate": date(1980, 5, 15),
                        "role_count": 5,
                        "active_role_count": 3,
                        "top_roles": ["Daglig leder (2)"],
                        "notable_companies": ["Equinor ASA"],
                    }
                ]
            )
            mock_repo.count_people_search = AsyncMock(return_value=1)

            response = client.get("/v1/people/search/results?q=Ola")

            assert response.status_code == 200
            data = response.json()
            assert data["total_count"] == 1
            assert data["query"] == "Ola"
            assert len(data["results"]) == 1
            assert data["results"][0]["name"] == "Ola Nordmann"
            assert data["results"][0]["active_role_count"] == 3

    @pytest.mark.asyncio
    async def test_requires_min_3_chars(self, client):
        """Query must be at least 3 characters."""
        response = client.get("/v1/people/search/results?q=Ol")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_respects_pagination_params(self, client):
        """Offset and limit are forwarded to repository."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.search_people_detailed = AsyncMock(return_value=[])
            mock_repo.count_people_search = AsyncMock(return_value=0)

            response = client.get("/v1/people/search/results?q=Test&offset=20&limit=10")

            assert response.status_code == 200
            mock_repo.search_people_detailed.assert_called_once()
            call_args = mock_repo.search_people_detailed.call_args
            assert call_args.kwargs.get("offset") == 20
            assert call_args.kwargs.get("limit") == 10

    @pytest.mark.asyncio
    async def test_returns_empty_results(self, client):
        """Returns empty results with zero count when no matches."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.search_people_detailed = AsyncMock(return_value=[])
            mock_repo.count_people_search = AsyncMock(return_value=0)

            response = client.get("/v1/people/search/results?q=Nonexistent")

            assert response.status_code == 200
            data = response.json()
            assert data["total_count"] == 0
            assert data["results"] == []

    @pytest.mark.asyncio
    async def test_limit_max_100(self, client):
        """Limit cannot exceed 100."""
        response = client.get("/v1/people/search/results?q=Test&limit=200")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_sort_by_name(self, client):
        """Sort by name is forwarded to repository."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.search_people_detailed = AsyncMock(return_value=[])
            mock_repo.count_people_search = AsyncMock(return_value=0)

            response = client.get("/v1/people/search/results?q=Test&sort_by=name&sort_order=asc")

            assert response.status_code == 200
            call_args = mock_repo.search_people_detailed.call_args
            assert call_args.kwargs.get("sort_by") == "name"
            assert call_args.kwargs.get("sort_order") == "asc"

    @pytest.mark.asyncio
    async def test_sort_by_active_roles(self, client):
        """Sort by active_roles is forwarded to repository."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.search_people_detailed = AsyncMock(return_value=[])
            mock_repo.count_people_search = AsyncMock(return_value=0)

            response = client.get("/v1/people/search/results?q=Test&sort_by=active_roles&sort_order=desc")

            assert response.status_code == 200
            call_args = mock_repo.search_people_detailed.call_args
            assert call_args.kwargs.get("sort_by") == "active_roles"

    @pytest.mark.asyncio
    async def test_invalid_sort_field_rejected(self, client):
        """Invalid sort_by value is rejected by validation."""
        response = client.get("/v1/people/search/results?q=Test&sort_by=invalid")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_sort_order_rejected(self, client):
        """Invalid sort_order value is rejected by validation."""
        response = client.get("/v1/people/search/results?q=Test&sort_order=random")
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_default_sort_params(self, client):
        """Default sort is role_count desc when not specified."""
        with patch("routers.v1.people.RoleRepository") as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.search_people_detailed = AsyncMock(return_value=[])
            mock_repo.count_people_search = AsyncMock(return_value=0)

            response = client.get("/v1/people/search/results?q=Test")

            assert response.status_code == 200
            call_args = mock_repo.search_people_detailed.call_args
            assert call_args.kwargs.get("sort_by") == "role_count"
            assert call_args.kwargs.get("sort_order") == "desc"

    def test_detailed_result_schema(self):
        """PersonSearchResultDetailed model serializes correctly."""
        from schemas.people import PersonSearchResultDetailed

        result = PersonSearchResultDetailed(
            name="Test Person",
            birthdate=date(1990, 1, 1),
            role_count=5,
            active_role_count=3,
            top_roles=["Daglig leder (2)", "Styremedlem (1)"],
            notable_companies=["Test AS"],
        )
        assert result.active_role_count == 3
        assert len(result.top_roles) == 2

    def test_paginated_search_schema(self):
        """PaginatedPersonSearch model serializes correctly."""
        from schemas.people import PaginatedPersonSearch, PersonSearchResultDetailed

        result = PaginatedPersonSearch(
            results=[
                PersonSearchResultDetailed(
                    name="Test",
                    birthdate=None,
                    role_count=1,
                    active_role_count=1,
                    top_roles=[],
                    notable_companies=[],
                )
            ],
            total_count=1,
            query="Test",
        )
        assert result.total_count == 1
        assert result.query == "Test"
