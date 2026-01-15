"""
Unit tests for RepairService.

Tests the data integrity repair phases:
- Phase 1: Ghost parent detection and repair
- Phase 2: Subunit audit and backfill
- Phase 3: Role backfill for unpolled companies

Follows AAA pattern (Arrange - Act - Assert).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from services.repair_service import RepairService


@pytest.fixture
def mock_db():
    """Create a mock async database session."""
    db = AsyncMock()
    db.add = MagicMock()  # session.add is sync
    return db


@pytest.fixture
def repair_service(mock_db):
    """Create a RepairService instance with mocked dependencies."""
    with patch("services.repair_service.BrregApiService") as mock_brreg, patch(
        "services.repair_service.UpdateService"
    ) as mock_update, patch("services.repair_service.CompanyRepository") as mock_company_repo, patch(
        "services.repair_service.SubUnitRepository"
    ) as mock_subunit_repo, patch(
        "services.repair_service.RoleRepository"
    ) as mock_role_repo:
        service = RepairService(mock_db, repair=False)
        service.brreg_api = mock_brreg.return_value
        service.update_service = mock_update.return_value
        service.company_repo = mock_company_repo.return_value
        service.subunit_repo = mock_subunit_repo.return_value
        service.role_repo = mock_role_repo.return_value
        yield service


class TestRepairServiceInit:
    """Tests for RepairService initialization."""

    def test_init_sets_repair_mode(self, mock_db):
        with patch("services.repair_service.BrregApiService"), patch(
            "services.repair_service.UpdateService"
        ), patch("services.repair_service.CompanyRepository"), patch(
            "services.repair_service.SubUnitRepository"
        ), patch("services.repair_service.RoleRepository"):
            service = RepairService(mock_db, repair=True)
            assert service.repair is True

            service_dry = RepairService(mock_db, repair=False)
            assert service_dry.repair is False


class TestFixGhostParents:
    """Tests for Phase 1: Ghost parent detection and repair."""

    @pytest.mark.asyncio
    async def test_fix_ghost_parents_no_ghosts_found(self, repair_service, mock_db):
        # Arrange: No ghost parents in DB
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_db.execute.return_value = mock_result

        # Act
        await repair_service.fix_ghost_parents(limit=10)

        # Assert: No repair attempts made
        repair_service.brreg_api.fetch_company.assert_not_called()

    @pytest.mark.asyncio
    async def test_fix_ghost_parents_dry_run_mode(self, repair_service, mock_db):
        # Arrange: One ghost parent found, but repair=False (dry run)
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [("123456789",)]
        mock_db.execute.return_value = mock_result
        repair_service.repair = False

        # Act
        await repair_service.fix_ghost_parents(limit=10)

        # Assert: No API calls made in dry run
        repair_service.brreg_api.fetch_company.assert_not_called()
        mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_fix_ghost_parents_repair_mode(self, repair_service, mock_db):
        # Arrange: One ghost parent found, repair=True
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [("123456789",)]
        mock_db.execute.return_value = mock_result
        repair_service.repair = True
        repair_service.brreg_api.fetch_company = AsyncMock(return_value={"organisasjonsnummer": "123456789"})
        repair_service.company_repo.create_or_update = AsyncMock()

        # Act
        await repair_service.fix_ghost_parents(limit=10)

        # Assert: Company was fetched and saved
        repair_service.brreg_api.fetch_company.assert_called_once_with("123456789")
        repair_service.company_repo.create_or_update.assert_called_once()
        mock_db.commit.assert_called_once()


class TestAuditSubunits:
    """Tests for Phase 2: Subunit audit and backfill."""

    @pytest.mark.asyncio
    async def test_audit_subunits_no_discrepancy(self, repair_service, mock_db):
        # Arrange: Company has matching subunit count
        mock_company = MagicMock()
        mock_company.orgnr = "123456789"

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_company]
        mock_db.execute.return_value = mock_result

        # API returns 2 subunits, local count is also 2
        repair_service.brreg_api.fetch_subunits = AsyncMock(return_value=[{}, {}])
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 2
        mock_db.execute.side_effect = [mock_result, mock_count_result]

        # Act
        await repair_service.audit_subunits(limit=1)

        # Assert: No backfill attempted
        repair_service.subunit_repo.create_batch.assert_not_called()

    @pytest.mark.asyncio
    async def test_audit_subunits_backfill_in_repair_mode(self, repair_service, mock_db):
        # Arrange: Company has fewer local subunits than API
        mock_company = MagicMock()
        mock_company.orgnr = "123456789"
        repair_service.repair = True

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_company]

        # API returns 3 subunits, local count is 1
        repair_service.brreg_api.fetch_subunits = AsyncMock(
            return_value=[
                {"organisasjonsnummer": "sub1", "navn": "Sub 1"},
                {"organisasjonsnummer": "sub2", "navn": "Sub 2"},
                {"organisasjonsnummer": "sub3", "navn": "Sub 3"},
            ]
        )
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 1
        mock_db.execute.side_effect = [mock_result, mock_count_result]
        repair_service.update_service._parse_date = MagicMock(return_value=None)

        # Act
        await repair_service.audit_subunits(limit=1)

        # Assert: Subunits were backfilled
        repair_service.subunit_repo.create_batch.assert_called_once()
        mock_db.commit.assert_called_once()


class TestBackfillRoles:
    """Tests for Phase 3: Role backfill for unpolled companies."""

    @pytest.mark.asyncio
    async def test_backfill_roles_no_companies_need_polling(self, repair_service, mock_db):
        # Arrange: No companies with NULL last_polled_roles
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        # Act
        await repair_service.backfill_roles(limit=10)

        # Assert: No API calls made
        repair_service.brreg_api.fetch_roles.assert_not_called()

    @pytest.mark.asyncio
    async def test_backfill_roles_fetches_and_saves(self, repair_service, mock_db):
        # Arrange: One company needs role polling
        mock_company = MagicMock()
        mock_company.orgnr = "123456789"
        repair_service.repair = True

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_company]
        mock_db.execute.return_value = mock_result

        repair_service.brreg_api.fetch_roles = AsyncMock(
            return_value=[{"type_kode": "DAGL", "person_navn": "Test Person"}]
        )
        repair_service.update_service._parse_date = MagicMock(return_value=None)
        repair_service.role_repo.create_batch = AsyncMock()
        repair_service.company_repo.update_last_polled_roles = AsyncMock()

        # Act
        await repair_service.backfill_roles(limit=1)

        # Assert: Roles were fetched, saved, and tracker updated
        repair_service.brreg_api.fetch_roles.assert_called_once_with("123456789")
        repair_service.role_repo.create_batch.assert_called_once()
        repair_service.company_repo.update_last_polled_roles.assert_called_once_with("123456789")
        mock_db.commit.assert_called_once()


class TestRunAllRepairs:
    """Tests for the orchestration method."""

    @pytest.mark.asyncio
    async def test_run_all_repairs_calls_all_phases(self, repair_service):
        # Arrange
        repair_service.fix_ghost_parents = AsyncMock()
        repair_service.audit_subunits = AsyncMock()
        repair_service.backfill_roles = AsyncMock()

        # Act
        await repair_service.run_all_repairs(limit=50)

        # Assert: All three phases were called
        repair_service.fix_ghost_parents.assert_called_once_with(limit=50)
        repair_service.audit_subunits.assert_called_once_with(limit=50)
        repair_service.backfill_roles.assert_called_once_with(limit=50)
