from unittest.mock import AsyncMock, MagicMock

import pytest

import models
from repositories.company.queries import QueryMixin
from repositories.company_filter_builder import FilterParams


# Helper class that uses the mixin
class MockRepository(QueryMixin):
    def __init__(self, db):
        self.db = db


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    session.execute.return_value = MagicMock()
    return session


@pytest.fixture
def repo(mock_db_session):
    return MockRepository(mock_db_session)


@pytest.mark.asyncio
async def test_get_all_simple(repo, mock_db_session):
    filters = FilterParams()

    # Mock return for _get_all_optimized
    # Phase 1: Orgnrs
    mock_db_session.execute.return_value.fetchall.return_value = [("123",)]

    # Phase 2: Companies
    mock_company = MagicMock(spec=models.Company)
    mock_company.orgnr = "123"

    mock_result_companies = MagicMock()
    mock_result_companies.scalars.return_value.all.return_value = [mock_company]

    # Phase 3: Financials
    mock_result_fin = MagicMock()
    mock_result_fin.all.return_value = []  # No financial data for simple case

    # Mock database execute sequence
    # 1. Select Orgnrs
    # 2. Select Companies
    # 3. Select Financials
    mock_db_session.execute.side_effect = [
        MagicMock(fetchall=MagicMock(return_value=[("123",)])),
        mock_result_companies,
        mock_result_fin,
    ]

    result = await repo.get_all(filters, limit=10)

    assert len(result) == 1
    # CompanyWithFinancials copies attributes, does not hold a .company object
    assert result[0].orgnr == "123"
    assert mock_db_session.execute.call_count == 3


@pytest.mark.asyncio
async def test_get_all_with_financial_filter(repo, mock_db_session):
    filters = FilterParams(min_revenue=1000)

    # Should call _get_all_with_financial_join
    mock_row = MagicMock()
    # Updated to 6 elements: [company, revenue, profit, op_profit, margin, equity_ratio]
    mock_row.__getitem__.side_effect = lambda idx: [MagicMock(), 1000, 100, 100, 10, 0.5][idx]

    # Mock result needs to be iterable yielding rows
    mock_result = MagicMock()
    mock_result.all.return_value = [mock_row]
    mock_db_session.execute.return_value = mock_result

    result = await repo.get_all(filters)

    assert len(result) == 1
    assert result[0].latest_revenue == 1000
    assert result[0].latest_equity_ratio == 0.5


@pytest.mark.asyncio
async def test_stream_all(repo, mock_db_session):
    filters = FilterParams()

    # Mock stream result (6 elements)
    mock_row = (MagicMock(), 100, 10, 10, 10, 0.5)

    # Async iterator mock
    async def async_gen():
        yield mock_row

    mock_stream = MagicMock()
    mock_stream.__aiter__.side_effect = lambda: async_gen()

    mock_db_session.stream.return_value = mock_stream

    count = 0
    async for item in repo.stream_all(filters, limit=10):
        count += 1
        assert item.latest_revenue == 100
        assert item.latest_equity_ratio == 0.5

    assert count == 1


@pytest.mark.asyncio
async def test_get_all_desc_sort_order(repo, mock_db_session):
    """Test descending sort order."""
    filters = FilterParams()

    mock_db_session.execute.side_effect = [
        MagicMock(fetchall=MagicMock(return_value=[("123",)])),
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[MagicMock(orgnr="123")])))),
        MagicMock(all=MagicMock(return_value=[])),
    ]

    result = await repo.get_all(filters, sort_order="desc")

    assert len(result) == 1


@pytest.mark.asyncio
async def test_get_all_with_name_search(repo, mock_db_session):
    """Test search relevance ordering for text queries."""
    filters = FilterParams(name="TestCompany")

    mock_db_session.execute.side_effect = [
        MagicMock(fetchall=MagicMock(return_value=[("123",)])),
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[MagicMock(orgnr="123")])))),
        MagicMock(all=MagicMock(return_value=[])),
    ]

    result = await repo.get_all(filters)

    assert len(result) == 1


@pytest.mark.asyncio
async def test_get_all_empty_phase1(repo, mock_db_session):
    """Test returns empty when no orgnrs found in phase 1."""
    filters = FilterParams()

    mock_db_session.execute.return_value = MagicMock(fetchall=MagicMock(return_value=[]))

    result = await repo.get_all(filters)

    assert result == []


@pytest.mark.asyncio
async def test_get_all_empty_phase2(repo, mock_db_session):
    """Test returns empty when no companies found in phase 2."""
    filters = FilterParams()

    mock_db_session.execute.side_effect = [
        MagicMock(fetchall=MagicMock(return_value=[("123",)])),
        MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))),
    ]

    result = await repo.get_all(filters)

    assert result == []


@pytest.mark.asyncio
async def test_get_paginated_orgnrs(repo, mock_db_session):
    """Test fetching paginated orgnrs for sitemap."""
    mock_result = MagicMock()
    mock_result.__iter__ = lambda self: iter(
        [
            MagicMock(orgnr="100000001"),
            MagicMock(orgnr="100000002"),
        ]
    )
    mock_db_session.execute.return_value = mock_result

    result = await repo.get_paginated_orgnrs(offset=0, limit=100)

    assert len(result) == 2
    assert result[0] == "100000001"
    assert result[1] == "100000002"


@pytest.mark.asyncio
async def test_get_paginated_orgnrs_with_keyset(repo, mock_db_session):
    """Test keyset pagination with after_orgnr."""
    mock_result = MagicMock()
    mock_result.__iter__ = lambda self: iter(
        [
            MagicMock(orgnr="100000003"),
        ]
    )
    mock_db_session.execute.return_value = mock_result

    result = await repo.get_paginated_orgnrs(after_orgnr="100000002", limit=100)

    assert len(result) == 1
    assert result[0] == "100000003"


@pytest.mark.asyncio
async def test_get_sitemap_anchors(repo, mock_db_session):
    """Test legacy sitemap anchors method."""
    # Mock count result
    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 100000

    # Mock anchor results (need multiple for the loop)
    mock_anchor_result1 = MagicMock()
    mock_anchor_result1.scalar.return_value = "100049999"
    mock_anchor_result2 = MagicMock()
    mock_anchor_result2.scalar.return_value = "100099999"

    mock_db_session.execute.side_effect = [
        mock_count_result,
        mock_anchor_result1,
        mock_anchor_result2,
    ]

    result = await repo.get_sitemap_anchors(page_size=50000, first_page_offset=0)

    assert len(result) >= 1


@pytest.mark.asyncio
async def test_get_sitemap_anchors_empty(repo, mock_db_session):
    """Test sitemap anchors with no data."""
    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 0
    mock_db_session.execute.return_value = mock_count_result

    result = await repo.get_sitemap_anchors()

    assert result == []


@pytest.mark.asyncio
async def test_get_sitemap_anchors_optimized(repo, mock_db_session):
    """Test optimized sitemap anchors using window function."""
    mock_result = MagicMock()
    mock_result.__iter__ = lambda self: iter(
        [
            ("100049999",),
            ("100099999",),
        ]
    )
    mock_db_session.execute.return_value = mock_result

    result = await repo.get_sitemap_anchors_optimized(page_size=50000, first_page_offset=0)

    assert len(result) == 2
    assert result[0] == "100049999"


@pytest.mark.asyncio
async def test_stream_all_desc_order(repo, mock_db_session):
    """Test stream with descending sort order."""
    filters = FilterParams()

    mock_row = (MagicMock(), 100, 10, 10, 10, 0.5)

    async def async_gen():
        yield mock_row

    mock_stream = MagicMock()
    mock_stream.__aiter__.side_effect = lambda: async_gen()
    mock_db_session.stream.return_value = mock_stream

    count = 0
    async for item in repo.stream_all(filters, sort_order="desc"):
        count += 1

    assert count == 1


@pytest.mark.asyncio
async def test_get_all_with_financial_sort(repo, mock_db_session):
    """Test sorting by financial column triggers financial join path."""
    filters = FilterParams()

    mock_row = MagicMock()
    mock_row.__getitem__.side_effect = lambda idx: [MagicMock(orgnr="123"), 5000, 500, 400, 10.0, 0.6][idx]
    mock_result = MagicMock()
    mock_result.all.return_value = [mock_row]
    mock_db_session.execute.return_value = mock_result

    result = await repo.get_all(filters, sort_by="revenue", sort_order="desc")

    assert len(result) == 1
    assert result[0].latest_revenue == 5000


@pytest.mark.asyncio
async def test_get_all_financial_join_asc_order(repo, mock_db_session):
    """Test financial join with ascending sort."""
    filters = FilterParams(min_revenue=100)

    mock_row = MagicMock()
    mock_row.__getitem__.side_effect = lambda idx: [MagicMock(orgnr="123"), 200, 20, 15, 5.0, 0.3][idx]
    mock_result = MagicMock()
    mock_result.all.return_value = [mock_row]
    mock_db_session.execute.return_value = mock_result

    result = await repo.get_all(filters, sort_order="asc")

    assert len(result) == 1
