import pytest
from unittest.mock import AsyncMock
from services.role_service import RoleService
from sqlalchemy.ext.asyncio import AsyncSession
from models import Role

@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)

@pytest.fixture
def role_service(mock_db):
    return RoleService(mock_db)

@pytest.mark.asyncio
async def test_get_roles_cached(role_service):
    # Arrange
    role_service.role_repo.is_cache_valid = AsyncMock(return_value=True)
    role_service.role_repo.get_by_orgnr = AsyncMock(return_value=[Role(orgnr="123")])
    role_service.brreg_api.fetch_roles = AsyncMock()

    # Act
    result = await role_service.get_roles("123")

    # Assert
    assert len(result) == 1
    role_service.role_repo.is_cache_valid.assert_called_with("123")
    role_service.brreg_api.fetch_roles.assert_not_called()

@pytest.mark.asyncio
async def test_get_roles_fetch_api_success(role_service):
    # Arrange
    role_service.role_repo.is_cache_valid = AsyncMock(return_value=False)
    role_service.role_repo.delete_by_orgnr = AsyncMock()
    role_service.role_repo.create_batch = AsyncMock()
    
    api_data = [{
        "type_kode": "DAGL",
        "type_beskrivelse": "Daglig leder",
        "person_navn": "Ola Nordmann",
        "rekkefoelge": 1
    }]
    role_service.brreg_api.fetch_roles = AsyncMock(return_value=api_data)

    # Act
    result = await role_service.get_roles("123")

    # Assert
    assert len(result) == 1
    assert result[0].type_kode == "DAGL"
    role_service.brreg_api.fetch_roles.assert_called_with("123")
    role_service.role_repo.delete_by_orgnr.assert_called()
    role_service.role_repo.create_batch.assert_called()

@pytest.mark.asyncio
async def test_get_roles_api_failure_fallback(role_service):
    # Arrange
    role_service.role_repo.is_cache_valid = AsyncMock(return_value=False)
    role_service.brreg_api.fetch_roles = AsyncMock(side_effect=Exception("API Error"))
    role_service.role_repo.get_by_orgnr = AsyncMock(return_value=[Role(orgnr="123", type_kode="STALE")])

    # Act
    result = await role_service.get_roles("123")

    # Assert
    assert len(result) == 1
    assert result[0].type_kode == "STALE"
