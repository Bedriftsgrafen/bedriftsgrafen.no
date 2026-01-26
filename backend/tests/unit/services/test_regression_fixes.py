import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from services.company_service import CompanyService
import models


@pytest.mark.asyncio
async def test_get_statistics_includes_missing_fields():
    """Test that get_statistics returns all expected fields."""
    # Arrange
    mock_db = AsyncMock()
    service = CompanyService(mock_db)

    # Mock repositories
    service.company_repo = AsyncMock()
    service.accounting_repo = AsyncMock()
    service.role_repo = AsyncMock()

    # Mock the service method get_aggregate_stats (not the repo method)
    service.get_aggregate_stats = AsyncMock(return_value={"total_count": 100, "total_employees": 500})
    service.accounting_repo.get_aggregated_stats.return_value = {"total_revenue": 1000.0}
    service.company_repo.get_geocoded_count.return_value = 80
    service.company_repo.get_new_companies_30d.return_value = 5
    service.role_repo.count_total_roles.return_value = 200

    # Act
    stats = await service.get_statistics()

    # Assert
    assert stats["total_companies"] == 100
    assert stats["total_employees"] == 500
    assert stats["geocoded_count"] == 80
    assert stats["new_companies_30d"] == 5
    assert stats["total_roles"] == 200
    assert stats["total_revenue"] == 1000.0


@pytest.mark.asyncio
async def test_get_company_detail_subunit_fallback():
    """Test that subunit fallback works when company is not found."""
    # Arrange
    mock_db = AsyncMock()
    service = CompanyService(mock_db)

    # Mock repositories
    service.company_repo = AsyncMock()
    service.subunit_repo = AsyncMock()

    # Simulate company not found
    from exceptions import CompanyNotFoundException

    service.company_repo.get_by_orgnr.side_effect = CompanyNotFoundException("999111222")

    # Mock subunit found
    mock_subunit = MagicMock(spec=models.SubUnit)
    mock_subunit.orgnr = "999111222"
    mock_subunit.navn = "Subunit Name"
    mock_subunit.parent_orgnr = "123456789"
    mock_subunit.organisasjonsform = "BEDR"
    mock_subunit.naeringskode = "62.010"
    mock_subunit.antall_ansatte = 10
    mock_subunit.stiftelsesdato = None
    mock_subunit.registreringsdato_enhetsregisteret = None
    mock_subunit.beliggenhetsadresse = {"poststed": "OSLO"}
    mock_subunit.postadresse = None
    mock_subunit.raw_data = {}

    service.subunit_repo.get_by_orgnr.return_value = mock_subunit
    service.company_repo.get_company_name.return_value = "Parent Company"

    # Mock the parent_name_cache to return None (no cached value)
    with patch("services.company_service.parent_name_cache") as mock_cache:
        mock_cache.get = AsyncMock(return_value=None)
        mock_cache.set = AsyncMock()

        # Act
        detail = await service.get_company_detail("999111222")

    # Assert
    assert isinstance(detail, dict)
    assert detail["orgnr"] == "999111222"
    assert detail["navn"] == "Subunit Name"
    assert detail["is_subunit"] is True
    assert detail["parent_navn"] == "Parent Company"
    assert detail["forretningsadresse"] == {"poststed": "OSLO"}
