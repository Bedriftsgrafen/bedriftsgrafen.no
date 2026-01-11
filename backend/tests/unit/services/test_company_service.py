"""
Unit tests for CompanyService.
"""
from unittest.mock import AsyncMock, MagicMock
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from services.company_service import CompanyService
from models import Company

@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)

@pytest.fixture
def service(mock_db):
    svc = CompanyService(mock_db)
    svc.company_repo = AsyncMock()
    svc.stats_repo = AsyncMock()
    svc.geocoding_service = AsyncMock()
    return svc

@pytest.mark.asyncio
async def test_get_company_success(service):
    # Arrange
    mock_company = MagicMock(spec=Company)
    mock_company.orgnr = "123456789"
    service.company_repo.get_by_orgnr.return_value = mock_company

    # Act
    result = await service.get_company_with_accounting("123456789")

    # Assert
    assert result == mock_company
    service.company_repo.get_by_orgnr.assert_called_once_with("123456789")

@pytest.mark.asyncio
async def test_get_company_not_found(service):
    # Arrange
    service.company_repo.get_by_orgnr.return_value = None

    # Act
    result = await service.get_company_with_accounting("999999999")

    # Assert
    assert result is None

@pytest.mark.asyncio
async def test_search_companies(service):
    # Arrange
    mock_results = [MagicMock(), MagicMock()]
    service.company_repo.search_by_name.return_value = mock_results

    # Act
    # Service expects name: str, not DTO
    await service.search_companies("Test")

    # Assert
    # Service might return serialized dicts, check implementation:
    # It returns list[dict]. Mock repo returns list[Company]. 
    # Service implementation: search_companies -> repo.search_by_name -> converts to dict -> caches
    # We need repo to return MagicMock objects that have attributes
    
    # We need to verify repo call
    service.company_repo.search_by_name.assert_called_once()
    assert service.company_repo.search_by_name.call_args[0][0] == "Test"


