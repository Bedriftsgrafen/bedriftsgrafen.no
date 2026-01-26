import pytest
import urllib.parse
from datetime import date, datetime
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from main import app, limiter
from database import get_db
from services.seo_service import SEOService

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
    cache = SEOService._sitemap_cache
    cache["total_companies"] = None
    cache["total_people"] = None
    cache["municipalities"] = None
    cache["company_anchors"] = []
    cache["person_anchors"] = []
    cache["expiry"] = None


@pytest.mark.asyncio
async def test_sitemap_index(mock_db_session, override_get_db):
    # Mock SEOService.get_sitemap_data
    with patch("routers.sitemap.SEOService.get_sitemap_data") as MockGetSitemap:
        MockGetSitemap.return_value = {
            "total_companies": 60000,
            "total_people": 10000,
            "municipalities": [("0301", datetime.now())],
            "company_anchors": [],
            "person_anchors": [],
        }

        response = client.get("/sitemap_index.xml")
        assert response.status_code == 200

        response = client.get("/sitemap-index.xml")
        assert response.status_code == 200

        response = client.get("/sitemap.xml")
        assert response.status_code == 200

        assert response.headers["content-type"] == "application/xml"
        content = response.text
        assert "<sitemapindex" in content
        assert "api/sitemaps/company-1.xml" in content
        assert "api/sitemaps/person-1.xml" in content


@pytest.mark.asyncio
async def test_sitemap_company_page_1(mock_db_session, override_get_db):
    # Mock municipality codes
    with (
        patch("routers.sitemap.SEOService.get_sitemap_data") as MockGetSitemap,
        patch("routers.sitemap.CompanyRepository") as MockCompanyRepo,
    ):
        MockGetSitemap.return_value = {
            "total_companies": 1000,
            "total_people": 1000,
            "municipalities": [("0301", datetime(2024, 1, 1))],
            "company_anchors": [],
            "person_anchors": [],
        }

        mock_company_repo = MockCompanyRepo.return_value
        mock_company_repo.get_paginated_orgnrs = AsyncMock(return_value=[("123", "2024-01-01T12:00:00")])
        mock_company_repo.get_sitemap_anchors = AsyncMock(return_value=[])

        response = client.get("/sitemaps/company-1.xml")

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
async def test_sitemap_company_page_2_with_anchors(mock_db_session, override_get_db):
    """Test that page 2 uses anchors for keyset pagination"""
    with (
        patch("routers.sitemap.SEOService.get_sitemap_data") as MockGetSitemap,
        patch("routers.sitemap.CompanyRepository") as MockCompanyRepo,
    ):
        # Total companies: enough for 2 pages (50,000 + 1)
        MockGetSitemap.return_value = {
            "total_companies": 60000,
            "total_people": 100,
            "municipalities": [],
            "company_anchors": ["999888777"],
            "person_anchors": [],
        }

        mock_company_repo = MockCompanyRepo.return_value
        mock_company_repo.get_paginated_orgnrs = AsyncMock(return_value=[("111222333", "2024-01-01")])

        response = client.get("/sitemaps/company_2.xml")

        assert response.status_code == 200
        # Verify get_paginated_orgnrs was called with after_orgnr="999888777"
        mock_company_repo.get_paginated_orgnrs.assert_called_with(offset=0, limit=50000, after_orgnr="999888777")
        assert "https://bedriftsgrafen.no/bedrift/111222333" in response.text


@pytest.mark.asyncio
async def test_sitemap_person_page_1(mock_db_session, override_get_db):
    # Mock result for people (name, birthdate, updated_at) via RoleRepository
    with (
        patch("routers.sitemap.RoleRepository") as MockRoleRepo,
        patch("routers.sitemap.SEOService.get_sitemap_data") as MockGetSitemap,
    ):
        mock_role_repo = MockRoleRepo.return_value
        MockGetSitemap.return_value = {
            "total_companies": 100,
            "total_people": 100,
            "municipalities": [],
            "company_anchors": [],
            "person_anchors": [],
        }

        mock_role_repo.get_paginated_commercial_people = AsyncMock(
            return_value=[("Ola Nordmann", date(1980, 1, 1), datetime(2024, 2, 2))]
        )

        response = client.get("/sitemaps/person-1.xml")

        assert response.status_code == 200
        content = response.text
        assert "<urlset" in content
        safe_ola = urllib.parse.quote("Ola Nordmann")
        assert f"https://bedriftsgrafen.no/person/{safe_ola}/1980-01-01" in content
        assert "<lastmod>2024-02-02</lastmod>" in content


@pytest.mark.asyncio
async def test_sitemap_person_page_2_with_anchors(mock_db_session, override_get_db):
    """Test that person page 2 uses anchors for keyset pagination"""
    with (
        patch("routers.sitemap.RoleRepository") as MockRoleRepo,
        patch("routers.sitemap.SEOService.get_sitemap_data") as MockGetSitemap,
    ):
        mock_role_repo = MockRoleRepo.return_value

        # Total people: enough for 2 pages (50,000 + 1)
        MockGetSitemap.return_value = {
            "total_companies": 100,
            "total_people": 60000,
            "municipalities": [],
            "company_anchors": [],
            "person_anchors": [("Zzz Last", date(1990, 12, 31))],
        }

        mock_role_repo.get_paginated_commercial_people = AsyncMock(
            return_value=[("Ola Nordmann", date(1980, 1, 1), datetime(2024, 2, 2))]
        )

        response = client.get("/sitemaps/person_2.xml")

        assert response.status_code == 200
        # Verify get_paginated_commercial_people was called with person anchors
        mock_role_repo.get_paginated_commercial_people.assert_called_with(
            offset=0, limit=50000, after_name="Zzz Last", after_birthdate=date(1990, 12, 31)
        )
        assert "Ola%20Nordmann" in response.text


@pytest.mark.asyncio
async def test_sitemap_invalid_filename(mock_db_session, override_get_db):
    response = client.get("/sitemaps/invalid.xml")
    assert response.status_code == 404
