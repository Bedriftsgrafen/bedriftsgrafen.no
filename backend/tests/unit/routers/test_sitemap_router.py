import pytest
from datetime import date
from unittest.mock import MagicMock, AsyncMock
from fastapi.testclient import TestClient
from main import app, limiter
from database import get_db

client = TestClient(app)
limiter.enabled = False


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    # Execute should return a SYNC MagicMock, not AsyncMock, because the result object methods (.all(), .scalar()) are sync
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


@pytest.mark.asyncio
async def test_sitemap_index(mock_db_session, override_get_db):
    # Mock company count and person count
    # 60k companies -> 2 pages
    # 10k people -> 1 page
    mock_db_session.execute.side_effect = [
        MagicMock(scalar=MagicMock(return_value=60000)),  # total_companies
        MagicMock(scalar=MagicMock(return_value=10000)),  # total_people
    ]

    response = client.get("/sitemap_index.xml")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/xml"
    content = response.text
    assert "<sitemapindex" in content
    assert "/api/sitemaps/company_1.xml" in content
    assert "/api/sitemaps/company_2.xml" in content
    assert "/api/sitemaps/person_1.xml" in content


@pytest.mark.asyncio
async def test_sitemap_company_page_1(mock_db_session, override_get_db):
    # Mock result for companies
    result_mock = MagicMock()
    result_mock.scalars.return_value = ["123", "456"]
    mock_db_session.execute.return_value = result_mock

    response = client.get("/sitemaps/company_1.xml")

    assert response.status_code == 200
    content = response.text
    assert "<urlset" in content
    # Page 1 should include static routes (e.g., homepage, utforsk)
    assert "<loc>https://bedriftsgrafen.no/</loc>" in content
    assert "<loc>https://bedriftsgrafen.no/utforsk</loc>" in content
    # And companies
    assert "https://bedriftsgrafen.no/bedrift/123" in content


@pytest.mark.asyncio
async def test_sitemap_person_page_1(mock_db_session, override_get_db):
    # Mock result for people (name, birthdate)
    result_mock = MagicMock()
    result_mock.all.return_value = [("Ola Nordmann", date(1980, 1, 1)), ("Kari Nordmann", None)]
    mock_db_session.execute.return_value = result_mock

    response = client.get("/sitemaps/person_1.xml")

    assert response.status_code == 200
    content = response.text
    assert "<urlset" in content
    assert "https://bedriftsgrafen.no/person/Ola Nordmann/1980-01-01" in content
    assert "https://bedriftsgrafen.no/person/Kari Nordmann/none" in content


@pytest.mark.asyncio
async def test_sitemap_invalid_filename(mock_db_session, override_get_db):
    response = client.get("/sitemaps/invalid.xml")
    assert response.status_code == 404

    response = client.get("/sitemaps/unknown_1.xml")
    assert response.status_code == 404
