import pytest
from unittest.mock import AsyncMock, MagicMock
from repositories.company.repository import CompanyRepository
from sqlalchemy.ext.asyncio import AsyncSession
import models


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def repo(mock_db):
    return CompanyRepository(mock_db)


@pytest.mark.asyncio
async def test_get_similar_companies_integration_flow(repo, mock_db):
    """
    Test the flow of get_similar_companies.
    The method now uses 3 DB calls:
    1. Source NACE guard query (checks naeringskode exists)
    2. UNION ALL similarity query (returns orgnrs with priorities)
    3. Final select (fetch full company objects with financials)
    """
    # 1. Mock source NACE guard: company has a valid naeringskode
    result_source = MagicMock()
    result_source.fetchone.return_value = ("62.010",)

    # 2. Mock UNION ALL query: returns 4 similar orgnrs with priorities
    result_similar = MagicMock()
    result_similar.fetchall.return_value = [
        ("111111111",),
        ("222222222",),
        ("333333333",),
        ("444444444",),
    ]

    # 3. Mock final fetch: full company objects with financials
    c1 = models.Company(orgnr="111111111", navn="C1")
    c2 = models.Company(orgnr="222222222", navn="C2")
    c3 = models.Company(orgnr="333333333", navn="C3")
    c4 = models.Company(orgnr="444444444", navn="C4")

    mock_final_res = MagicMock()
    mock_final_res.all.return_value = [
        (c1, 1000, 100, 120, 0.1, 0.4),
        (c2, 2000, 200, 220, 0.1, 0.4),
        (c3, 3000, 300, 320, 0.1, 0.4),
        (c4, 4000, 400, 420, 0.1, 0.4),
    ]

    mock_db.execute.side_effect = [
        result_source,   # NACE guard
        result_similar,  # UNION ALL
        mock_final_res,  # Final select
    ]

    # Act
    results = await repo.get_similar_companies("999999999", limit=5)

    # Assert
    assert len(results) == 4
    assert results[0].orgnr == "111111111"
    assert results[3].orgnr == "444444444"
    assert results[0].latest_revenue == 1000

    # 3 calls: source guard + UNION ALL + final select
    assert mock_db.execute.call_count == 3
