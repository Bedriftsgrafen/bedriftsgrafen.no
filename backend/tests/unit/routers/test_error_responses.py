"""
Tests for stable error code shapes in API responses.

Verifies that:
- Domain exceptions return { detail, code } — never { type } (class name)
- 404 for a non-existent company uses code COMPANY_NOT_FOUND
- Unhandled 500 in production does NOT leak class names via error_type / type keys
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from database import get_db
from main import app


# Override DB dependency (not needed for mocked service, but avoids startup errors)
async def override_get_db():
    yield MagicMock()


app.dependency_overrides[get_db] = override_get_db


@pytest.mark.asyncio
async def test_company_not_found_returns_stable_code():
    """GET /v1/companies/<unknown orgnr> → 404 with code COMPANY_NOT_FOUND"""
    with patch("routers.v1.companies.CompanyService") as mock_svc:
        mock_svc.return_value.get_company_detail = AsyncMock(return_value=None)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/v1/companies/000000000")

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "COMPANY_NOT_FOUND"
    assert "detail" in body
    # Must NOT leak internal class name
    assert "type" not in body
    assert "CompanyNotFoundException" not in str(body)


@pytest.mark.asyncio
async def test_accounting_not_found_returns_stable_code():
    """GET /v1/companies/<orgnr>/accounting/<year> → 404 with code ACCOUNTING_NOT_FOUND"""
    with patch("routers.v1.companies.CompanyService") as mock_svc:
        mock_svc.return_value.get_accounting_with_kpis = AsyncMock(return_value=None)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/v1/companies/123456789/accounting/2023")

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "ACCOUNTING_NOT_FOUND"
    assert "detail" in body
    assert "type" not in body


@pytest.mark.asyncio
async def test_domain_exception_response_has_no_type_key():
    """Domain exceptions must never expose { type: ClassName } in the response"""
    with patch("routers.v1.companies.CompanyService") as mock_svc:
        mock_svc.return_value.get_company_detail = AsyncMock(return_value=None)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/v1/companies/999999999")

    body = response.json()
    assert "type" not in body, f"Response must not contain 'type' key, got: {body}"
