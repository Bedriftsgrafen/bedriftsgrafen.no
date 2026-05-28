"""
Unit tests for StatsService benchmark functionality.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from models import IndustryStats, IndustrySubclassStats
from services.stats_service import StatsService


@pytest.mark.asyncio
async def test_get_industry_benchmark_success():
    # Arrange
    db = AsyncMock(spec=AsyncSession)
    service = StatsService(db)

    # Mock Repositories
    service.stats_repo = AsyncMock()
    service.company_repo = AsyncMock()

    # Mock IndustryStats with REAL model to verify attributes exist
    mock_industry_stats = IndustryStats(
        nace_division="62",
        company_count=100,
        avg_revenue=1000000.0,
        median_revenue=800000.0,
        avg_profit=100000.0,
        total_employees=1000,  # avg_employees will be 10.0
        avg_employees=10.0,
        avg_operating_margin=10.0,
    )

    # Mock Company Data (Financials + Employees)
    mock_financials = MagicMock()
    mock_financials.salgsinntekter = 2000000.0  # Double average
    mock_financials.aarsresultat = 50000.0  # Half average
    mock_financials.driftsresultat = 200000.0  # 10% margin

    mock_employees = 20  # Double average

    # Configure repository returns
    service.stats_repo.get_industry_stats.return_value = mock_industry_stats
    service.stats_repo.get_benchmark_percentiles.return_value = {
        "revenue": 92,
        "profit": 40,
        "employees": 87,
        "operating_margin": 55,
    }
    service.company_repo.get_company_with_latest_financials.return_value = (mock_financials, mock_employees)

    # Act
    result = await service.get_industry_benchmark("62", "123456789")

    # Assert
    assert result is not None
    assert result["orgnr"] == "123456789"
    assert result["nace_division"] == "62"

    assert result["revenue"]["company_value"] == 2000000.0
    assert result["revenue"]["percentile"] == 92

    assert result["profit"]["company_value"] == 50000.0
    assert result["profit"]["percentile"] == 40

    assert result["employees"]["company_value"] == 20
    assert result["employees"]["industry_avg"] == 10.0
    assert result["employees"]["percentile"] == 87
    assert result["operating_margin"]["company_value"] == 10.0
    assert result["operating_margin"]["industry_avg"] == 10.0
    assert result["operating_margin"]["percentile"] == 55


@pytest.mark.asyncio
async def test_get_industry_benchmark_no_industry_data():
    # Arrange
    db = AsyncMock(spec=AsyncSession)
    service = StatsService(db)

    # Mock Repositories
    service.stats_repo = AsyncMock()
    service.company_repo = AsyncMock()

    # Mock empty industry result
    service.stats_repo.get_industry_stats.return_value = None

    # We still need to mock company repo to avoid errors, though it might not be awaited if first task returns None?
    # Actually asyncio.gather waits for ALL tasks. So we should mock it.
    service.company_repo.get_company_with_latest_financials.return_value = (None, None)

    # Act
    result = await service.get_industry_benchmark("99", "123456789")

    # Assert
    assert result is None


@pytest.mark.asyncio
async def test_get_industry_benchmark_fallback():
    """Test fallback from 5-digit subclass to 2-digit division when subclass has no data."""
    # Arrange
    db = AsyncMock(spec=AsyncSession)
    service = StatsService(db)

    service.stats_repo = AsyncMock()
    service.company_repo = AsyncMock()

    # Mock IndustryStats (Subclass = None, Division = Found)
    # Mock IndustryStats (Subclass = None, Division = Found)
    mock_division_stats = IndustryStats(
        nace_division="62",
        company_count=500,
        avg_revenue=1000.0,
        median_revenue=800.0,
        avg_profit=100.0,
        total_employees=5000,  # avg_employees=10.0
        avg_employees=10.0,
        avg_operating_margin=10.0,
    )

    # Subclass returns None
    service.stats_repo.get_industry_subclass_stats.return_value = None
    # Division returns stats
    service.stats_repo.get_industry_stats.return_value = mock_division_stats
    service.stats_repo.get_benchmark_percentiles.return_value = {
        "revenue": 80,
        "profit": 95,
        "employees": 90,
        "operating_margin": 75,
    }

    # Mock Company
    mock_financials = MagicMock()
    mock_financials.salgsinntekter = 2000.0
    mock_financials.aarsresultat = 500.0
    mock_financials.driftsresultat = 200.0
    mock_employees = 20

    service.company_repo.get_company_with_latest_financials.return_value = (mock_financials, mock_employees)

    # Act
    # Request with 5-digit code
    result = await service.get_industry_benchmark("62.010", "123456789")

    # Assert
    assert result is not None
    assert result["nace_code"] == "62"  # Should change to fallback division code
    assert result["nace_division"] == "62"
    assert result["company_count"] == 500

    # Verify calls
    # 1. Called subclass
    service.stats_repo.get_industry_subclass_stats.assert_called_with("62.010")
    # 2. Called division fallback
    service.stats_repo.get_industry_stats.assert_called_with("62")


@pytest.mark.asyncio
async def test_get_industry_benchmark_subclass_success():
    """Test success with 5-digit subclass data (no fallback needed)."""
    # Arrange
    db = AsyncMock(spec=AsyncSession)
    service = StatsService(db)

    service.stats_repo = AsyncMock()
    service.company_repo = AsyncMock()

    # Mock Subclass Stats with REAL model
    mock_subclass_stats = IndustrySubclassStats(
        nace_code="62.010",
        company_count=50,
        avg_revenue=5000.0,  # Higher avg for specific niche
        median_revenue=4000.0,
        avg_profit=500.0,
        total_employees=250,  # avg_employees=5.0
        avg_employees=5.0,
        avg_operating_margin=20.0,
    )

    service.stats_repo.get_industry_subclass_stats.return_value = mock_subclass_stats
    service.stats_repo.get_benchmark_percentiles.return_value = {
        "revenue": 20,
        "profit": 35,
        "employees": 55,
        "operating_margin": 30,
    }

    # Mock Company
    mock_financials = MagicMock()
    mock_financials.salgsinntekter = 2000.0
    mock_financials.aarsresultat = 200.0
    mock_financials.driftsresultat = 100.0
    mock_employees = 5
    service.company_repo.get_company_with_latest_financials.return_value = (mock_financials, mock_employees)

    # Act
    result = await service.get_industry_benchmark("62.010", "123456789")

    # Assert
    assert result is not None
    assert result["nace_code"] == "62.010"  # Kept original code
    assert result["company_count"] == 50

    # Verify calls
    service.stats_repo.get_industry_subclass_stats.assert_called_with("62.010")
    # Should NOT satisfy fallback
    service.stats_repo.get_industry_stats.assert_not_called()


@pytest.mark.asyncio
async def test_get_industry_benchmark_excludes_company_operating_margin_outliers():
    db = AsyncMock(spec=AsyncSession)
    service = StatsService(db)

    service.stats_repo = AsyncMock()
    service.company_repo = AsyncMock()

    service.stats_repo.get_industry_stats.return_value = IndustryStats(
        nace_division="62",
        company_count=100,
        avg_revenue=1000000.0,
        median_revenue=800000.0,
        avg_profit=100000.0,
        total_employees=1000,
        avg_employees=10.0,
        avg_operating_margin=10.0,
    )
    service.stats_repo.get_benchmark_percentiles.return_value = {
        "revenue": 90,
        "profit": 90,
        "employees": 90,
        "operating_margin": None,
    }

    mock_financials = MagicMock()
    mock_financials.salgsinntekter = 100000.0
    mock_financials.aarsresultat = 50000.0
    mock_financials.driftsresultat = 150000.0
    service.company_repo.get_company_with_latest_financials.return_value = (mock_financials, 10)

    result = await service.get_industry_benchmark("62", "123456789")

    assert result is not None
    assert result["operating_margin"]["company_value"] is None
    service.stats_repo.get_benchmark_percentiles.assert_awaited_once_with(
        "62",
        municipality_code=None,
        company_revenue=100000.0,
        company_profit=50000.0,
        company_employees=10,
        company_operating_margin=None,
    )
