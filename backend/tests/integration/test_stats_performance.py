import pytest
import time
from unittest.mock import patch, AsyncMock, MagicMock
from services.company_service import CompanyService
from services.dtos import CompanyFilterDTO


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar.return_value = 0
    result_mock.fetchone.return_value = None
    session.execute.return_value = result_mock

    nested_cm = MagicMock()
    nested_cm.__aenter__ = AsyncMock(return_value=session)
    nested_cm.__aexit__ = AsyncMock(return_value=None)
    session.begin_nested = MagicMock(return_value=nested_cm)

    return session


@pytest.mark.asyncio
async def test_get_statistics_performance(mock_db_session):
    """
    Performance test for the get_statistics service method.
    Verifies that the refactored logic uses fast paths and sub-100ms execution.
    """
    service = CompanyService(mock_db_session)

    # Mock repositories to return data quickly
    # In a real integration test with a test DB, we'd have actual data,
    # but for performance logic verification, we mock the repo calls.
    with (
        patch.object(service.company_repo, "count", new_callable=AsyncMock),
        patch.object(service.company_repo, "get_total_employees", new_callable=AsyncMock),
        patch.object(service.accounting_repo, "get_aggregated_stats", new_callable=AsyncMock) as mock_acc_stats,
        patch.object(service, "get_aggregate_stats", new_callable=AsyncMock) as mock_agg_service,
    ):
        # Setup mocks for fast path
        mock_agg_service.return_value = {"total_count": 1200000, "total_employees": 5000000}
        mock_acc_stats.return_value = {
            "total_revenue": 1000000000.0,
            "total_ebitda": 100000000.0,
            "profitable_percentage": 65.0,
            "solid_company_percentage": 40.0,
            "avg_operating_margin": 8.5,
        }

        # Time the execution
        start_time = time.time()
        stats = await service.get_statistics()
        execution_time = time.time() - start_time

        # Assertions
        assert stats["total_companies"] == 1200000
        assert stats["total_revenue"] == 1000000000.0
        assert execution_time < 0.1  # Must be sub-100ms when using fast paths

        # Verify that get_aggregate_stats was called with empty filters (the fast path)
        mock_agg_service.assert_called_once()
        args, kwargs = mock_agg_service.call_args
        assert isinstance(args[0], CompanyFilterDTO)
        assert args[0].is_empty()


@pytest.mark.asyncio
async def test_get_statistics_fallback_consistency(mock_db_session):
    """
    Verifies that get_statistics correctly falls back to fast=True count
    if the materialized view fails.
    """
    service = CompanyService(mock_db_session)

    # We patch the instance methods directly to be sure
    service.get_aggregate_stats = AsyncMock(side_effect=Exception("View not ready"))
    service.company_repo.count = AsyncMock(return_value=1199500)
    service.company_repo.get_total_employees = AsyncMock(return_value=5000000)

    # Mock cache to return None
    with (
        patch("services.company_service.search_cache.get", new_callable=AsyncMock) as mock_cache_get,
        patch("services.company_service.search_cache.set", new_callable=AsyncMock),
    ):
        mock_cache_get.return_value = None

        # Financial stats and others should still work
        service.accounting_repo.get_aggregated_stats = AsyncMock(
            return_value={
                "total_revenue": 0,
                "total_ebitda": 0,
                "profitable_percentage": 0,
                "solid_company_percentage": 0,
                "avg_operating_margin": 0,
            }
        )

        stats = await service.get_statistics()

    # Verify it used the fast count estimate
    service.company_repo.count.assert_called_with(fast=True)
    assert stats["total_companies"] == 1199500
