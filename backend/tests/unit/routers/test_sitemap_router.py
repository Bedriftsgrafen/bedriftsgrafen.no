import pytest
import urllib.parse
from datetime import date, datetime
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from main import app, limiter
from database import get_db
from routers.sitemap import _cache

client = TestClient(app)
limiter.enabled = False


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    result_mock = MagicMock()
    session.execute.return_value = result_mock
    return session


@pytest.fixture
def override_get_db(mock_db_session):
    async def _get_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides = {}


@pytest.fixture(autouse=True)
def clear_sitemap_cache():
    """Ensure cache is empty before each test"""
    _cache["total_companies"] = None
    _cache["total_people"] = None
    _cache["municipalities"] = None
    _cache["expiry"] = None


@pytest.mark.asyncio
async def test_sitemap_index(mock_db_session, override_get_db):
    # Mock repositories
    with (
        patch("routers.sitemap.RoleRepository") as MockRoleRepo,
        patch("routers.sitemap.StatsRepository") as MockStatsRepo,
    ):
        mock_role_repo = MockRoleRepo.return_value
        mock_role_repo.count_commercial_people = AsyncMock(return_value=10000)

        mock_stats_repo = MockStatsRepo.return_value
        mock_stats_repo.get_municipality_codes_with_updates = AsyncMock(return_value=[("0301", datetime.now())])

        mock_db_session.execute.return_value = MagicMock(scalar=MagicMock(return_value=60000))

        response = client.get("/sitemap_index.xml")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/xml"
        content = response.text
        assert "<sitemapindex" in content
        assert "/api/sitemaps/company_1.xml" in content
        assert "/api/sitemaps/person_1.xml" in content


@pytest.mark.asyncio
async def test_sitemap_company_page_1(mock_db_session, override_get_db):
    # Mock municipality codes
    with (
        patch("routers.sitemap.StatsRepository") as MockStatsRepo,
        patch("routers.sitemap.CompanyRepository") as MockCompanyRepo,
    ):
        mock_stats_repo = MockStatsRepo.return_value
        mock_stats_repo.get_municipality_codes_with_updates = AsyncMock(return_value=[("0301", datetime(2024, 1, 1))])

        mock_company_repo = MockCompanyRepo.return_value
        mock_company_repo.get_paginated_orgnrs = AsyncMock(return_value=[("123", "2024-01-01T12:00:00")])

        # For cached counts call in router
        mock_db_session.execute.return_value = MagicMock(scalar=MagicMock(return_value=100))

        response = client.get("/sitemaps/company_1.xml")

        assert response.status_code == 200
        content = response.text
        assert "<urlset" in content
        # Static routes
        assert "<loc>https://bedriftsgrafen.no/</loc>" in content
        # Municipality with formatted date
        assert "<loc>https://bedriftsgrafen.no/kommune/0301</loc>" in content
        assert "<lastmod>2024-01-01</lastmod>" in content
        # Company with formatted date
        assert "https://bedriftsgrafen.no/bedrift/123" in content
        assert "<lastmod>2024-01-01</lastmod>" in content


@pytest.mark.asyncio
async def test_sitemap_person_page_1(mock_db_session, override_get_db):
    # Mock result for people (name, birthdate, updated_at) via RoleRepository
    with patch("routers.sitemap.RoleRepository") as MockRepo:
        mock_repo = MockRepo.return_value
        mock_repo.get_paginated_commercial_people = AsyncMock(
            return_value=[("Ola Nordmann", date(1980, 1, 1), datetime(2024, 2, 2))]
        )

        response = client.get("/sitemaps/person_1.xml")

        assert response.status_code == 200
        content = response.text
        assert "<urlset" in content
        safe_ola = urllib.parse.quote("Ola Nordmann")
        assert f"https://bedriftsgrafen.no/person/{safe_ola}/1980-01-01" in content
        assert "<lastmod>2024-02-02</lastmod>" in content


@pytest.mark.asyncio
async def test_sitemap_invalid_filename(mock_db_session, override_get_db):
    response = client.get("/sitemaps/invalid.xml")
    assert response.status_code == 404
