"""Unit tests for PersonService — role enrichment with financial context."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from schemas.people import PersonRoleResponse


class TestPersonServiceGetEnrichedRoles:
    """Tests for PersonService.get_enriched_roles orchestration."""

    @pytest.fixture
    def service(self):
        from services.person_service import PersonService

        svc = PersonService(AsyncMock())
        svc.role_repo = MagicMock()
        svc.accounting_repo = MagicMock()
        return svc

    def _make_role(self, **overrides):
        """Create a mock Role model with eager-loaded company."""
        role = MagicMock()
        role.orgnr = overrides.get("orgnr", "123456789")
        role.type_kode = overrides.get("type_kode", "DAGL")
        role.type_beskrivelse = overrides.get("type_beskrivelse", "Daglig leder")
        role.enhet_navn = overrides.get("enhet_navn", "Test AS")
        role.fratraadt = overrides.get("fratraadt", False)
        role.rekkefoelge = overrides.get("rekkefoelge", 1)
        role.foedselsdato = overrides.get("foedselsdato", date(1980, 1, 1))

        company = overrides.get("company", MagicMock())
        if "company" not in overrides:
            company.navn = "Test AS"
            company.organisasjonsform = "AS"
            company.antall_ansatte = 50
            company.naeringskode = "62.010"
            company.stiftelsesdato = date(2020, 1, 1)
            company.konkurs = False
            company.under_avvikling = False
        role.company = company
        return role

    def _make_fin(self, **overrides):
        """Create a mock LatestFinancials row."""
        fin = MagicMock()
        fin.aar = overrides.get("aar", 2023)
        fin.salgsinntekter = overrides.get("salgsinntekter", 10_000_000)
        fin.aarsresultat = overrides.get("aarsresultat", 500_000)
        fin.driftsresultat = overrides.get("driftsresultat", 400_000)
        fin.egenkapitalandel = overrides.get("egenkapitalandel", 35.0)
        return fin

    @pytest.mark.asyncio
    async def test_enriched_roles_with_financials(self, service):
        """Roles are enriched with matching financial data."""
        role = self._make_role(orgnr="123456789")
        fin = self._make_fin()
        service.role_repo.get_person_commercial_roles = AsyncMock(return_value=[role])
        service.accounting_repo.get_latest_financials_batch = AsyncMock(return_value={"123456789": fin})

        result = await service.get_enriched_roles("Test Person", None, 1980, False)

        assert len(result) == 1
        assert isinstance(result[0], PersonRoleResponse)
        assert result[0].orgnr == "123456789"
        assert result[0].organisasjonsform == "AS"
        assert result[0].latest_aar == 2023
        assert result[0].latest_salgsinntekter == 10_000_000

    @pytest.mark.asyncio
    async def test_enriched_roles_without_financials(self, service):
        """Roles without financials have None for financial fields."""
        role = self._make_role(orgnr="999999999")
        service.role_repo.get_person_commercial_roles = AsyncMock(return_value=[role])
        service.accounting_repo.get_latest_financials_batch = AsyncMock(return_value={})

        result = await service.get_enriched_roles("Test Person", None, None, False)

        assert result[0].latest_aar is None
        assert result[0].latest_salgsinntekter is None
        assert result[0].latest_aarsresultat is None

    @pytest.mark.asyncio
    async def test_enriched_roles_without_company(self, service):
        """Roles with no company use safe defaults."""
        role = self._make_role(company=None)
        service.role_repo.get_person_commercial_roles = AsyncMock(return_value=[role])
        service.accounting_repo.get_latest_financials_batch = AsyncMock(return_value={})

        result = await service.get_enriched_roles("Test", None, None, False)

        assert result[0].organisasjonsform is None
        assert result[0].konkurs is False
        assert result[0].enhet_navn == "Test AS"

    @pytest.mark.asyncio
    async def test_empty_roles_returns_empty(self, service):
        """Empty roles list returns empty result."""
        service.role_repo.get_person_commercial_roles = AsyncMock(return_value=[])
        service.accounting_repo.get_latest_financials_batch = AsyncMock(return_value={})

        result = await service.get_enriched_roles("Nobody", None, None, False)

        assert result == []
        service.accounting_repo.get_latest_financials_batch.assert_called_once_with([])

    @pytest.mark.asyncio
    async def test_batch_fetches_unique_orgnrs(self, service):
        """Financials are fetched for unique orgnrs only."""
        role1 = self._make_role(orgnr="111111111")
        role2 = self._make_role(orgnr="222222222")
        role3 = self._make_role(orgnr="111111111")
        service.role_repo.get_person_commercial_roles = AsyncMock(return_value=[role1, role2, role3])
        service.accounting_repo.get_latest_financials_batch = AsyncMock(return_value={})

        await service.get_enriched_roles("Test", None, None, False)

        call_args = service.accounting_repo.get_latest_financials_batch.call_args[0][0]
        assert sorted(call_args) == ["111111111", "222222222"]

    @pytest.mark.asyncio
    async def test_passes_through_repo_params(self, service):
        """Correctly forwards name, birthdate, birthyear, include_all to repo."""
        service.role_repo.get_person_commercial_roles = AsyncMock(return_value=[])
        service.accounting_repo.get_latest_financials_batch = AsyncMock(return_value={})

        await service.get_enriched_roles("Ola Nordmann", date(1996, 3, 12), None, True)

        service.role_repo.get_person_commercial_roles.assert_called_once_with(
            "Ola Nordmann", birthdate=date(1996, 3, 12), birthyear=None, include_all=True
        )


class TestPersonServiceGetConnections:
    """Tests for PersonService.get_connections orchestration."""

    @pytest.fixture
    def service(self):
        from services.person_service import PersonService

        svc = PersonService(AsyncMock())
        svc.role_repo = MagicMock()
        svc.accounting_repo = MagicMock()
        return svc

    @pytest.mark.asyncio
    async def test_returns_connections_with_gdpr_birth_year(self, service):
        """Connections return birth_year (int) instead of full birthdate."""
        from schemas.people import PersonConnectionResponse

        service.role_repo.get_person_connections = AsyncMock(
            return_value=[
                {
                    "name": "Kari Nordmann",
                    "foedselsdato": date(1975, 6, 15),
                    "shared_company_count": 2,
                    "shared_companies": [
                        {
                            "orgnr": "111111111",
                            "navn": "Felles AS",
                            "person_role": "Daglig leder",
                            "connection_role": "Styreleder",
                        },
                        {
                            "orgnr": "222222222",
                            "navn": "Annet AS",
                            "person_role": "Styremedlem",
                            "connection_role": "Daglig leder",
                        },
                    ],
                }
            ]
        )

        result = await service.get_connections("Ola", None, 1980, False)

        assert len(result) == 1
        assert isinstance(result[0], PersonConnectionResponse)
        assert result[0].name == "Kari Nordmann"
        assert result[0].birth_year == 1975
        assert result[0].shared_company_count == 2
        assert len(result[0].shared_companies) == 2

    @pytest.mark.asyncio
    async def test_null_birthdate_gives_null_birth_year(self, service):
        """Connections without birthdate have birth_year=None."""
        service.role_repo.get_person_connections = AsyncMock(
            return_value=[
                {
                    "name": "Ukjent Person",
                    "foedselsdato": None,
                    "shared_company_count": 1,
                    "shared_companies": [
                        {"orgnr": "333333333", "navn": "X AS", "person_role": "DAGL", "connection_role": "STYR"},
                    ],
                }
            ]
        )

        result = await service.get_connections("Ola", None, None, False)

        assert result[0].birth_year is None

    @pytest.mark.asyncio
    async def test_empty_connections(self, service):
        """Returns empty list when no connections found."""
        service.role_repo.get_person_connections = AsyncMock(return_value=[])

        result = await service.get_connections("Nobody", None, None, False)

        assert result == []

    @pytest.mark.asyncio
    async def test_forwards_params_to_repo(self, service):
        """Correctly forwards all params to role_repo.get_person_connections."""
        service.role_repo.get_person_connections = AsyncMock(return_value=[])

        await service.get_connections("Ola", date(1980, 1, 1), None, True, limit=10)

        service.role_repo.get_person_connections.assert_called_once_with(
            "Ola",
            birthdate=date(1980, 1, 1),
            birthyear=None,
            include_all=True,
            limit=10,
        )
