import pytest
from unittest.mock import AsyncMock, MagicMock, patch, mock_open
from services.geocoding_batch_service import GeocodingBatchService
from models import Company


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    # Mock execute/scalar behaviors as needed
    session.execute.return_value = MagicMock()
    session.execute.return_value.scalar.return_value = 0
    session.execute.return_value.all.return_value = []

    # Mock begin_nested specifically
    # It must be a synchronous method returning an async context manager
    nested_cm = MagicMock()
    nested_cm.__aenter__.return_value = session  # This doesn't need to be async if using MagicMock?
    # Wait, __aenter__ MUST return an awaitable.
    nested_cm.__aenter__ = AsyncMock(return_value=session)
    nested_cm.__aexit__ = AsyncMock(return_value=None)

    session.begin_nested = MagicMock(return_value=nested_cm)

    return session


@pytest.fixture
def service(mock_db_session):
    return GeocodingBatchService(mock_db_session)


@pytest.mark.asyncio
async def test_geocode_company_success(service, mock_db_session):
    company = MagicMock(spec=Company)
    company.orgnr = "123456789"
    company.forretningsadresse = {"adressenavn": "Testveien", "husnummer": "1"}
    company.postadresse = {}

    with patch("services.geocoding_service.GeocodingService.build_address_string", return_value="Testveien 1"):
        service.geocoder.geocode_address = AsyncMock(return_value=(10.0, 20.0))

        result = await service.geocode_company(company)

        assert result is True
        # Check that update was executed
        assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_geocode_company_no_address(service, mock_db_session):
    company = MagicMock(spec=Company)
    company.orgnr = "123456789"

    with patch("services.geocoding_service.GeocodingService.build_address_string", return_value=""):
        result = await service.geocode_company(company)

        assert result is False
        # Should still update attempts
        assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_geocode_company_no_coordinates(service, mock_db_session):
    company = MagicMock(spec=Company)
    company.orgnr = "123456789"

    with patch("services.geocoding_service.GeocodingService.build_address_string", return_value="Testveien 1"):
        service.geocoder.geocode_address = AsyncMock(return_value=None)

        result = await service.geocode_company(company)

        assert result is False
        # Should update attempts
        assert mock_db_session.execute.called


@pytest.mark.asyncio
async def test_run_batch_empty(service):
    service.get_companies_needing_geocoding = AsyncMock(return_value=[])

    stats = await service.run_batch()

    assert stats["processed"] == 0
    assert stats["remaining"] == 0


@pytest.mark.asyncio
async def test_run_batch_processing(service, mock_db_session):
    # Mock companies
    company = MagicMock()
    company.orgnr = "123"
    company.forretningsadresse = {}
    company.postadresse = {}

    service.get_companies_needing_geocoding = AsyncMock(return_value=[company])
    service.count_companies_needing_geocoding = AsyncMock(return_value=0)
    service.count_geocoded_companies = AsyncMock(return_value=1)

    # Mock geocoder behavior inside run_batch
    # run_batch manually uses self.geocoder.geocode_address
    service.geocoder.geocode_address = AsyncMock(return_value=(10, 10))

    with (
        patch("httpx.AsyncClient"),
        patch("services.geocoding_service.GeocodingService.build_address_string", return_value="Test Addr"),
    ):
        stats = await service.run_batch()

    assert stats["processed"] == 1
    assert stats["success"] == 1


@pytest.mark.asyncio
async def test_run_postal_code_backfill_file_not_found(service):
    with patch("os.path.exists", return_value=False):
        result = await service.run_postal_code_backfill()
        assert "error" in result
        assert result["error"] == "File not found"


@pytest.mark.asyncio
async def test_run_postal_code_backfill_success(service, mock_db_session):
    # Need 11 columns. Indices 9=lat, 10=long.
    # 0=Postnummer, 1..8=Dummy
    csv_content = "Postnummer\tX\tX\tX\tX\tX\tX\tX\tX\tLat\tLon\n0101\t_\t_\t_\t_\t_\t_\t_\t_\t59.9\t10.7"

    # Run synchronously to avoid threading issues with mock_open
    async def fast_to_thread(func, *args, **kwargs):
        return func(*args, **kwargs)

    with (
        patch("os.path.exists", return_value=True),
        patch("builtins.open", mock_open(read_data=csv_content)),
        patch("asyncio.to_thread", side_effect=fast_to_thread),
    ):
        # Mock db execute to return companies
        # The service uses keyset pagination loop

        # We need to mock the result of `await self.db.execute(stmt)`
        # It calls result.all()

        # First call returns 1 company, Second call returns empty (EOF)
        company = MagicMock()
        company.orgnr = "123"
        company.forretningsadresse = {"postnummer": "0101"}

        batch_result = MagicMock()
        batch_result.all.return_value = [company]

        empty_result = MagicMock()
        empty_result.all.return_value = []

        # Side effect for execute: return batch, then empty
        # Note: execute is also called for UPDATES. We need to match calls or be careful.
        # But for simplistic testing, we can just ensure it doesn't crash and returns expected flow.

        # Mock execute side effect to handle infinite loop logic
        # Flow:
        # 1. Fetch companies (SELECT) -> returns [company]
        # 2. Update company (UPDATE)
        # 3. Commit (implicit in logic or explicit)
        # 4. Fetch companies (SELECT) -> returns [] (Break loop)

        # We need a side_effect that checks arguments or just provides enough return values.
        # But wait, execute is called for SELECT and UPDATE.

        # Let's use a side_effect function
        def db_execute_side_effect(stmt, *args, **kwargs):
            mock_result = MagicMock()
            s_stmt = str(stmt).upper()
            if "SELECT" in s_stmt:
                # First call returns company, subsequent empty to break loop
                if db_execute_side_effect.select_called:
                    mock_result.all.return_value = []
                else:
                    mock_result.all.return_value = [company]
                    db_execute_side_effect.select_called = True
            else:
                # UPDATE
                pass
            return mock_result

        db_execute_side_effect.select_called = False
        mock_db_session.execute.side_effect = db_execute_side_effect

        result = await service.run_postal_code_backfill()

        assert result["updated"] == 1
        assert result["postal_codes_loaded"] == 1
