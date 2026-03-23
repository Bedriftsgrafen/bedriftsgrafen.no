"""
Unit tests for ExportService.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from services.dtos import CompanyFilterDTO
from services.export_service import ExportService


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.mark.asyncio
async def test_stream_companies_csv_structure(mock_db):
    # Arrange
    service = ExportService(mock_db)
    service.company_service = AsyncMock()  # Parent is AsyncMock

    # Mock stream generator
    async def mock_stream(filters):
        c1 = MagicMock()
        c1.orgnr = "123"
        c1.navn = "Test AS"
        # Setup address dicts
        c1.forretningsadresse = {"kommune": "Oslo"}
        c1.postadresse = {}
        c1.organisasjonsform = "AS"
        c1.naeringskode = "62.000"
        c1.antall_ansatte = 10
        c1.latest_revenue = 100.0
        c1.latest_profit = 10.0
        c1.stiftelsesdato = None
        yield c1

    # Use MagicMock instead of AsyncMock for generator method to avoid coroutine wrapping
    service.company_service.stream_companies = MagicMock(side_effect=mock_stream)

    filters = CompanyFilterDTO()

    # Act
    chunks = []
    async for chunk in service.stream_companies_csv(filters):
        chunks.append(chunk.decode("utf-8"))

    # Assert
    full_text = "".join(chunks)
    lines = full_text.splitlines()
    assert full_text.startswith("\ufeff")
    assert "Org.nr;Navn" in lines[0]
    assert "123;Test AS" in lines[1]


@pytest.mark.asyncio
async def test_export_row_limit_enforced(mock_db):
    service = ExportService(mock_db)
    service.company_service = AsyncMock()

    # Request max limit allowed in DTO (1000)
    # We want to test logic inside service that caps it?
    # ExportService.EXPORT_ROW_LIMIT is 1000. DTO default checks limit <= 1000.
    # So actually DTO validation happens before service.
    # Service also has: if not filters.limit or filters.limit > self.EXPORT_ROW_LIMIT: filters.limit = 1000
    # But DTO prevents filters.limit > 1000.
    # So we can test if filters.limit is missing (None) or 0 (implicit unlimited?)
    # DTO defaults limit=100.

    filters = CompanyFilterDTO(limit=1000)
    # Manually bypass DTO validation to test service logic if possible,
    # but filters is typed.
    # Let's just verify it passes limit=1000.

    async def empty_gen(f):
        if False:
            yield None

    # Use MagicMock here too
    service.company_service.stream_companies = MagicMock(side_effect=empty_gen)

    async for _ in service.stream_companies_csv(filters):
        pass

    # Assert
    call_args = service.company_service.stream_companies.call_args
    passed_filters = call_args[0][0]
    assert passed_filters.limit == 1000


@pytest.mark.asyncio
async def test_stream_companies_csv_uses_postadresse_fallback(mock_db):
    """Should use postadresse when forretningsadresse is missing."""
    service = ExportService(mock_db)
    service.company_service = AsyncMock()

    async def mock_stream(filters):
        c1 = MagicMock()
        c1.orgnr = "456"
        c1.navn = "Fallback AS"
        c1.forretningsadresse = None  # No business address
        c1.postadresse = {"kommune": "Bergen"}  # Use postal address
        c1.organisasjonsform = "AS"
        c1.naeringskode = "62.000"
        c1.antall_ansatte = 5
        c1.latest_revenue = 50.0
        c1.latest_profit = 5.0
        c1.stiftelsesdato = None
        yield c1

    service.company_service.stream_companies = MagicMock(side_effect=mock_stream)
    filters = CompanyFilterDTO()

    chunks = []
    async for chunk in service.stream_companies_csv(filters):
        chunks.append(chunk.decode("utf-8"))

    full_text = "".join(chunks)
    assert "Bergen" in full_text


@pytest.mark.asyncio
async def test_stream_companies_csv_handles_none_addresses(mock_db):
    """Should handle companies with no addresses."""
    service = ExportService(mock_db)
    service.company_service = AsyncMock()

    async def mock_stream(filters):
        c1 = MagicMock()
        c1.orgnr = "789"
        c1.navn = "No Address AS"
        c1.forretningsadresse = None
        c1.postadresse = None
        c1.organisasjonsform = "AS"
        c1.naeringskode = None
        c1.antall_ansatte = None
        c1.latest_revenue = None
        c1.latest_profit = None
        c1.stiftelsesdato = None
        yield c1

    service.company_service.stream_companies = MagicMock(side_effect=mock_stream)
    filters = CompanyFilterDTO()

    chunks = []
    async for chunk in service.stream_companies_csv(filters):
        chunks.append(chunk.decode("utf-8"))

    full_text = "".join(chunks)
    assert "789;No Address AS" in full_text


@pytest.mark.asyncio
async def test_stream_companies_csv_escapes_semicolons(mock_db):
    """Should escape semicolons in data to avoid CSV corruption."""
    service = ExportService(mock_db)
    service.company_service = AsyncMock()

    async def mock_stream(filters):
        c1 = MagicMock()
        c1.orgnr = "111"
        c1.navn = "Test; With; Semicolons"
        c1.forretningsadresse = {"kommune": "Oslo"}
        c1.postadresse = None
        c1.organisasjonsform = "AS"
        c1.naeringskode = "62.000"
        c1.antall_ansatte = 1
        c1.latest_revenue = None
        c1.latest_profit = None
        c1.stiftelsesdato = None
        yield c1

    service.company_service.stream_companies = MagicMock(side_effect=mock_stream)
    filters = CompanyFilterDTO()

    chunks = []
    async for chunk in service.stream_companies_csv(filters):
        chunks.append(chunk.decode("utf-8"))

    full_text = "".join(chunks)
    # Semicolons should be replaced with commas
    assert "Test, With, Semicolons" in full_text


@pytest.mark.asyncio
async def test_stream_companies_csv_formats_date(mock_db):
    """Should format stiftelsesdato as ISO date."""
    from datetime import date

    service = ExportService(mock_db)
    service.company_service = AsyncMock()

    async def mock_stream(filters):
        c1 = MagicMock()
        c1.orgnr = "222"
        c1.navn = "Dated AS"
        c1.forretningsadresse = {"kommune": "Oslo"}
        c1.postadresse = None
        c1.organisasjonsform = "AS"
        c1.naeringskode = "62.000"
        c1.antall_ansatte = 1
        c1.latest_revenue = None
        c1.latest_profit = None
        c1.stiftelsesdato = date(2020, 5, 15)
        yield c1

    service.company_service.stream_companies = MagicMock(side_effect=mock_stream)
    filters = CompanyFilterDTO()

    chunks = []
    async for chunk in service.stream_companies_csv(filters):
        chunks.append(chunk.decode("utf-8"))

    full_text = "".join(chunks)
    assert "2020-05-15" in full_text


@pytest.mark.asyncio
async def test_stream_companies_csv_error_propagates(mock_db):
    """Should propagate errors from streaming."""
    service = ExportService(mock_db)
    service.company_service = AsyncMock()

    async def mock_stream_error(filters):
        raise Exception("Stream failed")
        yield  # Make it a generator

    service.company_service.stream_companies = MagicMock(side_effect=mock_stream_error)
    filters = CompanyFilterDTO()

    with pytest.raises(Exception, match="Stream failed"):
        async for _ in service.stream_companies_csv(filters):
            pass


@pytest.mark.asyncio
async def test_stream_companies_csv_caps_unlimited_limit(mock_db):
    """Should cap limit to EXPORT_ROW_LIMIT when not set."""
    service = ExportService(mock_db)
    service.company_service = AsyncMock()

    async def empty_gen(f):
        if False:
            yield None

    service.company_service.stream_companies = MagicMock(side_effect=empty_gen)

    # Create filters without limit (defaults to 100 in DTO, but test capping logic)
    filters = CompanyFilterDTO()
    filters.limit = None  # Simulate no limit

    async for _ in service.stream_companies_csv(filters):
        pass

    call_args = service.company_service.stream_companies.call_args
    passed_filters = call_args[0][0]
    assert passed_filters.limit == service.EXPORT_ROW_LIMIT
