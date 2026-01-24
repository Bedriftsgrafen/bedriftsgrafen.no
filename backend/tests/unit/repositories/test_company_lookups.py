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
    We mock the DB responses to simulate finding hits in different priority steps.
    """
    # 1. Mock source company fetching
    # execute() #1 -> source company info
    mock_source = MagicMock()
    mock_source.naeringskode = "62.010"
    mock_source.kommune = "OSLO"
    mock_source.postnummer = "0101"

    # 2. Mock Priority 1 (Postnummer)
    # Returns 1 hit
    mock_res_p1 = MagicMock()
    mock_res_p1.fetchall.return_value = [("111111111",)]

    # 3. Mock Priority 2 (Kommune)
    # Returns 2 hits
    mock_res_p2 = MagicMock()
    mock_res_p2.fetchall.return_value = [("222222222",), ("333333333",)]

    # 4. Mock Priority 3 (Prefix + Kommune)
    # Returns 0 hits (to test fallback)
    mock_res_p3 = MagicMock()
    mock_res_p3.fetchall.return_value = []

    # 5. Mock Priority 4 (Prefix + Any)
    # Returns 1 hit
    mock_res_p4 = MagicMock()
    mock_res_p4.fetchall.return_value = [("444444444",)]

    # 6. Mock Final Fetch (get full objects with financials)
    mock_final_res = MagicMock()
    # Return matched objects as tuples (Company, revenue, profit, op_profit, margin, equity)
    c1 = models.Company(orgnr="111111111", navn="C1")
    c2 = models.Company(orgnr="222222222", navn="C2")
    c3 = models.Company(orgnr="333333333", navn="C3")
    c4 = models.Company(orgnr="444444444", navn="C4")

    # Mock joined rows: (Company, rev, profit, op_profit, margin, equity)
    mock_final_res.all.return_value = [
        (c1, 1000, 100, 120, 0.1, 0.4),
        (c2, 2000, 200, 220, 0.1, 0.4),
        (c3, 3000, 300, 320, 0.1, 0.4),
        (c4, 4000, 400, 420, 0.1, 0.4),
    ]

    # Setup side_effect for db.execute
    # Sequence of calls:
    # 1. Source fetch (fetchone)
    # 2. Priority 1 (fetchall)
    # 3. Priority 2 (fetchall)
    # 4. Priority 3 (fetchall)
    # 5. Priority 4 (fetchall)
    # 6. Final select (all)

    result_mock_1 = MagicMock()
    result_mock_1.fetchone.return_value = mock_source

    # Chain the return values for subsequent calls
    mock_db.execute.side_effect = [
        result_mock_1,  # Source
        mock_res_p1,  # P1
        mock_res_p2,  # P2
        mock_res_p3,  # P3
        mock_res_p4,  # P4
        mock_final_res,  # Final
    ]

    # Act
    results = await repo.get_similar_companies("999999999", limit=5)

    # Assert
    assert len(results) == 4
    # Note: results now contain CompanyWithFinancials wrappers which flat-copy company attributes
    assert results[0].orgnr == "111111111"
    assert results[3].orgnr == "444444444"
    assert results[0].latest_revenue == 1000

    # Verification of calls count
    # We expect 6 calls to execute
    assert mock_db.execute.call_count == 6
