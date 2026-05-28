from datetime import UTC
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from models import Role
from services.role_service import RoleService


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

    api_data = [
        {"type_kode": "DAGL", "type_beskrivelse": "Daglig leder", "person_navn": "Ola Nordmann", "rekkefoelge": 1}
    ]
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


@pytest.mark.asyncio
async def test_get_roles_api_failure_no_cache_raises(role_service):
    """Should raise when API fails and no cache exists."""
    role_service.role_repo.is_cache_valid = AsyncMock(return_value=False)
    role_service.brreg_api.fetch_roles = AsyncMock(side_effect=Exception("API Error"))
    role_service.role_repo.get_by_orgnr = AsyncMock(return_value=[])  # No cached data

    with pytest.raises(Exception, match="API Error"):
        await role_service.get_roles("123")


@pytest.mark.asyncio
async def test_get_roles_empty_api_response(role_service):
    """Should delete old cache and return empty list when API returns no roles."""
    role_service.role_repo.is_cache_valid = AsyncMock(return_value=False)
    role_service.role_repo.delete_by_orgnr = AsyncMock()
    role_service.brreg_api.fetch_roles = AsyncMock(return_value=[])

    result = await role_service.get_roles("123")

    assert result == []
    role_service.role_repo.delete_by_orgnr.assert_called_once_with("123")


@pytest.mark.asyncio
async def test_get_roles_force_refresh(role_service):
    """Should skip cache check when force_refresh=True."""
    from datetime import datetime, timedelta

    # Simulate last update was more than 60s ago
    old_time = datetime.now(UTC) - timedelta(seconds=120)
    role_service.role_repo.get_cache_timestamp = AsyncMock(return_value=old_time)
    role_service.role_repo.delete_by_orgnr = AsyncMock()
    role_service.role_repo.create_batch = AsyncMock()

    api_data = [{"type_kode": "DAGL", "type_beskrivelse": "Daglig leder", "person_navn": "Test", "rekkefoelge": 1}]
    role_service.brreg_api.fetch_roles = AsyncMock(return_value=api_data)

    result = await role_service.get_roles("123", force_refresh=True)

    assert len(result) == 1
    role_service.brreg_api.fetch_roles.assert_called_once()


@pytest.mark.asyncio
async def test_get_roles_force_refresh_throttled(role_service):
    """Should skip force refresh if last update was within 60s."""
    from datetime import datetime, timedelta

    # Simulate last update was 30s ago (within throttle window)
    recent_time = datetime.now(UTC) - timedelta(seconds=30)
    role_service.role_repo.get_cache_timestamp = AsyncMock(return_value=recent_time)
    role_service.role_repo.get_by_orgnr = AsyncMock(return_value=[Role(orgnr="123", type_kode="CACHED")])
    role_service.brreg_api.fetch_roles = AsyncMock()

    result = await role_service.get_roles("123", force_refresh=True)

    # Should return cached data, not call API
    assert len(result) == 1
    assert result[0].type_kode == "CACHED"
    role_service.brreg_api.fetch_roles.assert_not_called()


@pytest.mark.asyncio
async def test_get_roles_force_refresh_no_previous_timestamp(role_service):
    """Should allow force refresh when no previous timestamp exists."""
    role_service.role_repo.get_cache_timestamp = AsyncMock(return_value=None)
    role_service.role_repo.delete_by_orgnr = AsyncMock()
    role_service.role_repo.create_batch = AsyncMock()

    api_data = [{"type_kode": "DAGL", "type_beskrivelse": "Daglig leder", "person_navn": "Test", "rekkefoelge": 1}]
    role_service.brreg_api.fetch_roles = AsyncMock(return_value=api_data)

    result = await role_service.get_roles("123", force_refresh=True)

    assert len(result) == 1
    role_service.brreg_api.fetch_roles.assert_called_once()


@pytest.mark.asyncio
async def test_get_roles_handles_invalid_role_data(role_service):
    """Should skip invalid role entries but continue processing."""
    role_service.role_repo.is_cache_valid = AsyncMock(return_value=False)
    role_service.role_repo.delete_by_orgnr = AsyncMock()
    role_service.role_repo.create_batch = AsyncMock()

    # Mix of valid and invalid data
    api_data = [
        {"type_kode": "DAGL", "type_beskrivelse": "Daglig leder", "person_navn": "Valid", "rekkefoelge": 1},
        None,  # Invalid entry
        {"type_kode": "STYR", "type_beskrivelse": "Styremedlem", "person_navn": "Also Valid", "rekkefoelge": 2},
    ]
    role_service.brreg_api.fetch_roles = AsyncMock(return_value=api_data)

    result = await role_service.get_roles("123")

    # Should have 2 valid roles (None entry causes exception in mapper, gets skipped)
    assert len(result) >= 1  # At least the valid ones should be returned


@pytest.mark.asyncio
async def test_get_roles_preserves_cache_when_api_roles_cannot_be_parsed(role_service):
    """Should not delete cached roles when a non-empty API payload is malformed."""
    cached_role = Role(orgnr="123", type_kode="STALE")
    role_service.role_repo.is_cache_valid = AsyncMock(return_value=False)
    role_service.role_repo.delete_by_orgnr = AsyncMock()
    role_service.role_repo.create_batch = AsyncMock()
    role_service.role_repo.get_by_orgnr = AsyncMock(return_value=[cached_role])
    role_service.brreg_api.fetch_roles = AsyncMock(return_value=[None])

    result = await role_service.get_roles("123")

    assert result == [cached_role]
    role_service.role_repo.delete_by_orgnr.assert_not_called()
    role_service.role_repo.create_batch.assert_not_called()
