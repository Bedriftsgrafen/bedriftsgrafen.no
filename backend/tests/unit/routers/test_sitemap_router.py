import pytest
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
    # Mock total count return
    mock_db_session.execute.return_value.scalar.return_value = 100000
    # With 50k per page, this should result in:
    # Page 1: 50k - 1 + homepage
    # Page 2: 50k
    # Page 3: remaining (100k - (50k-1) - 50k? No.)
    # Logic: ceil((100000 + 1) / 50000) = ceil(100001 / 50000) = 3 pages

    response = client.get("/sitemap_index.xml")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/xml"
    content = response.text
    assert "<sitemapindex" in content
    assert "/api/sitemaps/1.xml" in content
    assert "/api/sitemaps/3.xml" in content


@pytest.mark.asyncio
async def test_sitemap_page_1(mock_db_session, override_get_db):
    # Mock result for companies
    mock_db_session.execute.return_value.all.return_value = [("123",), ("456",)]

    response = client.get("/sitemaps/1.xml")

    assert response.status_code == 200
    content = response.text
    assert "<urlset" in content
    # Page 1 should include homepage
    assert "<loc>https://bedriftsgrafen.no</loc>" in content
    # And companies
    assert "https://bedriftsgrafen.no/?orgnr=123" in content


@pytest.mark.asyncio
async def test_sitemap_page_2(mock_db_session, override_get_db):
    mock_db_session.execute.return_value.all.return_value = [("789",)]

    response = client.get("/sitemaps/2.xml")

    assert response.status_code == 200
    content = response.text
    # Page 2 should NOT include homepage
    assert "<loc>https://bedriftsgrafen.no</loc>" not in content
    assert "https://bedriftsgrafen.no/?orgnr=789" in content


@pytest.mark.asyncio
async def test_sitemap_empty_page(mock_db_session, override_get_db):
    mock_db_session.execute.return_value.all.return_value = []

    response = client.get("/sitemaps/99.xml")
    assert response.status_code == 200
    assert "<urlset" in response.text
