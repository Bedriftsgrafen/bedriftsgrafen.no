import time
from unittest.mock import AsyncMock, MagicMock

import pytest

import models
from services.company_service import CompanyService


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar.return_value = 0
    result_mock.scalar_one_or_none.return_value = None
    session.execute.return_value = result_mock

    nested_cm = MagicMock()
    nested_cm.__aenter__ = AsyncMock(return_value=session)
    nested_cm.__aexit__ = AsyncMock(return_value=None)
    session.begin_nested = MagicMock(return_value=nested_cm)

    return session


def _make_totals_row(
    total_count: int = 1200000,
    total_roles: int = 3000000,
    total_employees: int = 5000000,
    geocoded_count: int = 900000,
    new_companies_30d: int = 1500,
    total_revenue: float = 1000000000.0,
    total_ebitda: float = 100000000.0,
    profitable_percentage: float = 65.0,
    solid_company_percentage: float = 40.0,
    avg_operating_margin: float = 8.5,
) -> MagicMock:
    """Create a mock CompanyTotals ORM row."""
    row = MagicMock(spec=models.CompanyTotals)
    row.total_count = total_count
    row.total_roles = total_roles
    row.total_employees = total_employees
    row.geocoded_count = geocoded_count
    row.new_companies_30d = new_companies_30d
    row.total_revenue = total_revenue
    row.total_ebitda = total_ebitda
    row.profitable_percentage = profitable_percentage
    row.solid_company_percentage = solid_company_percentage
    row.avg_operating_margin = avg_operating_margin
    return row


@pytest.mark.asyncio
async def test_get_statistics_performance(mock_db_session):
    """
    Performance test for the get_statistics service method.
    Verifies that the ORM-based query returns correct data in sub-100ms.
    """
    service = CompanyService(mock_db_session)

    # Mock the ORM query to return a CompanyTotals row
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = _make_totals_row()
    mock_db_session.execute.return_value = result_mock

    # Time the execution
    start_time = time.time()
    stats = await service.get_statistics()
    execution_time = time.time() - start_time

    # Assertions
    assert stats["total_companies"] == 1200000
    assert stats["total_revenue"] == 1000000000.0
    assert stats["total_employees"] == 5000000
    assert stats["profitable_percentage"] == 65.0
    assert execution_time < 0.1  # Must be sub-100ms


@pytest.mark.asyncio
async def test_get_statistics_returns_empty_when_no_row(mock_db_session):
    """
    Verifies that get_statistics returns an empty dict when the
    company_totals view has no data.
    """
    service = CompanyService(mock_db_session)

    # Mock to return None (no row in view)
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = result_mock

    stats = await service.get_statistics()

    assert stats == {}


@pytest.mark.asyncio
async def test_get_statistics_handles_db_error(mock_db_session):
    """
    Verifies that get_statistics gracefully handles database errors
    by returning an empty dict instead of raising.
    """
    service = CompanyService(mock_db_session)

    mock_db_session.execute.side_effect = Exception("Connection lost")

    stats = await service.get_statistics()

    assert stats == {}
