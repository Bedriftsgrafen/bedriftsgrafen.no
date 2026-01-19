"""
MECE SQL Statement Verification for StatsRepository.
Verifies that the repository generates correct live-aggregation SQL for complex filters.
"""

import pytest
from repositories.stats_repository import StatsRepository
from repositories.company_filter_builder import FilterParams
from unittest.mock import MagicMock, AsyncMock


@pytest.fixture
def repo():
    return StatsRepository(AsyncMock())


def test_filtered_geography_stats_advanced_filters_sql(repo):
    """
    MECE: Advanced filters (Org Form, Financials) MUST trigger live aggregation with correct joins.
    """
    captured_stmt = None

    async def mock_execute(stmt):
        nonlocal captured_stmt
        captured_stmt = stmt
        mock_result = MagicMock()
        mock_result.all.return_value = []
        return mock_result

    repo.db.execute = mock_execute

    # Advanced filters including financials and org forms
    filters = FilterParams(
        naeringskode="62",
        organisasjonsform=["AS"],
        min_revenue=10000000,  # 10M MNOK
        min_employees=5,
    )

    # Act
    import asyncio

    asyncio.run(repo.get_filtered_geography_stats(level="county", metric="company_count", filters=filters))

    # Assert
    sql_str = str(captured_stmt.compile(compile_kwargs={"literal_binds": True})).lower()

    # Must use live aggregation (bedrifter table) not materialized views
    assert "from bedrifter" in sql_str

    # Must join with latest_financials due to min_revenue
    assert "join latest_financials" in sql_str

    # Verify filter application in WHERE
    where_clause = sql_str.split("where")[-1]
    assert "organisasjonsform in ('as')" in where_clause
    assert "antall_ansatte >= 5" in where_clause
    assert "salgsinntekter >= 10000000" in where_clause


def test_filtered_geography_stats_simple_nace_sql(repo):
    """
    MECE: Simple NACE/Location filters should still use live-aggregation if called via this method.
    """
    captured_stmt = None

    async def mock_execute(stmt):
        nonlocal captured_stmt
        captured_stmt = stmt
        mock_result = MagicMock()
        mock_result.all.return_value = []
        return mock_result

    repo.db.execute = mock_execute

    filters = FilterParams(naeringskode="62.011")

    # Act
    import asyncio

    asyncio.run(repo.get_filtered_geography_stats(level="municipality", metric="total_employees", filters=filters))

    # Assert
    sql_str = str(captured_stmt.compile(compile_kwargs={"literal_binds": True})).lower()

    assert "from bedrifter" in sql_str
    assert "join latest_financials" not in sql_str

    where_clause = sql_str.split("where")[-1]
    assert "naeringskode like '62.011%'" in where_clause
    assert "sum(bedrifter.antall_ansatte)" in sql_str
