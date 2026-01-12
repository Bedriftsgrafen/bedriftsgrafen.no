"""
Unit tests for StatsService benchmark functionality.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from services.stats_service import StatsService
from models import IndustryStats, IndustrySubclassStats


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
        avg_operating_margin=0.10,
    )

    # Mock Company Data (Financials + Employees)
    mock_financials = MagicMock()
    mock_financials.salgsinntekter = 2000000.0  # Double average
    mock_financials.aarsresultat = 50000.0  # Half average
    mock_financials.driftsresultat = 200000.0  # 10% margin

    mock_employees = 20  # Double average

    # Configure repository returns
    service.stats_repo.get_industry_stats.return_value = mock_industry_stats
    service.company_repo.get_company_with_latest_financials.return_value = (mock_financials, mock_employees)

    # Act
    result = await service.get_industry_benchmark("62", "123456789")

    # Assert
    assert result is not None
    assert result["orgnr"] == "123456789"
    assert result["nace_division"] == "62"

    # Revenue: 2M vs 1M avg -> Ratio 2.0 -> Percentile 95
    assert result["revenue"]["company_value"] == 2000000.0
    assert result["revenue"]["percentile"] == 95

    # Profit: 50k vs 100k avg -> Ratio 0.5 -> Percentile 25
    assert result["profit"]["company_value"] == 50000.0
    assert result["profit"]["percentile"] == 25

    # Employees: 20 vs 10 avg -> Ratio 2.0 -> Percentile 95
    assert result["employees"]["company_value"] == 20
    assert result["employees"]["percentile"] == 95


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
        avg_operating_margin=0.1,
    )

    # Subclass returns None
    service.stats_repo.get_industry_subclass_stats.return_value = None
    # Division returns stats
    service.stats_repo.get_industry_stats.return_value = mock_division_stats

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
        avg_operating_margin=0.2,
    )

    service.stats_repo.get_industry_subclass_stats.return_value = mock_subclass_stats

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
