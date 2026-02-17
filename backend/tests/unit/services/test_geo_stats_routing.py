import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from services.stats_service import StatsService
from repositories.company_filter_builder import FilterParams
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def service(mock_db):
    return StatsService(mock_db)


@pytest.mark.asyncio
async def test_geography_stats_routing_simple(service, mock_db):
    """Test that simple filters route to materialized views (get_county_stats)."""
    # Simple filter: only NACE
    filters = FilterParams(naeringskode="62")

    with patch.object(service, "get_county_stats", new_callable=AsyncMock) as mock_view_call:
        mock_view_call.return_value = []
        service.stats_repo = MagicMock()
        service.stats_repo.get_filtered_geography_stats = AsyncMock()

        # Act
        await service.get_geography_stats(level="county", metric="company_count", filters=filters)

        # Assert
        mock_view_call.assert_called_once()
        service.stats_repo.get_filtered_geography_stats.assert_not_called()


@pytest.mark.asyncio
async def test_geography_stats_routing_complex(service, mock_db):
    """Test that complex filters route to live aggregation."""
    # Complex filter: NACE + min_employees
    filters = FilterParams(naeringskode="62", min_employees=10)

    with patch.object(service, "get_county_stats", new_callable=AsyncMock) as mock_view_call:
        service.stats_repo = MagicMock()
        service.stats_repo.get_filtered_geography_stats = AsyncMock(return_value=[])
        service.stats_repo.get_municipality_populations = AsyncMock(return_value=[])
        service._ensure_municipality_names_loaded = AsyncMock()

        # Act
        await service.get_geography_stats(level="county", metric="company_count", filters=filters)

        # Assert
        mock_view_call.assert_not_called()
        service.stats_repo.get_filtered_geography_stats.assert_called_once()
