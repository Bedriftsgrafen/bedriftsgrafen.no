import asyncio
import contextlib
import hashlib
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

import models
from repositories.accounting_repository import AccountingRepository
from repositories.company import CompanyRepository, CompanyWithFinancials
from repositories.company_filter_builder import FilterParams
from repositories.role_repository import RoleRepository
from repositories.subunit_repository import SubUnitRepository
from services.brreg_api_service import BrregApiService
from services.dtos import CompanyFilterDTO
from services.geocoding_service import GeocodingService
from services.nace_service import NaceService
from schemas.companies import Naeringskode
from utils.cache import AsyncLRUCache

logger = logging.getLogger(__name__)

# Module-level cache shared across service instances
search_cache = AsyncLRUCache(maxsize=500, ttl=60)
stats_cache = AsyncLRUCache(maxsize=100, ttl=60)  # 60s cache for stats
parent_name_cache = AsyncLRUCache(maxsize=1000, ttl=3600)  # 1h cache for parent names

# Lock to prevent thundering herd on stats computation
_stats_lock = asyncio.Lock()


class CompanyService:
    # Class-level set to track active sync tasks across service instances
    _syncing_orgnrs: set[str] = set()

    def __init__(self, db: AsyncSession):
        self.db = db
        self.company_repo = CompanyRepository(db)
        self.accounting_repo = AccountingRepository(db)
        self.role_repo = RoleRepository(db)
        self.subunit_repo = SubUnitRepository(db)
        self.brreg_api = BrregApiService()
        self.geocoding_service = GeocodingService()

    async def get_companies(self, filters: CompanyFilterDTO) -> list[CompanyWithFinancials]:
        """Get companies matching filters."""
        repo_filters = FilterParams(**filters.to_count_params())
        results = await self.company_repo.get_all(
            filters=repo_filters,
            skip=filters.skip,
            limit=filters.limit,
            sort_by=filters.sort_by,
            sort_order=filters.sort_order,
        )
        await self._enrich_nace_codes(results)
        return results

    async def stream_companies(self, filters: CompanyFilterDTO):
        """Stream companies efficiently for exports."""
        repo_filters = FilterParams(**filters.to_count_params())
        async for company in self.company_repo.stream_all(
            filters=repo_filters,
            skip=filters.skip,
            limit=filters.limit,
            sort_by=filters.sort_by,
            sort_order=filters.sort_order,
        ):
            yield company

    async def count_companies(self, filters: CompanyFilterDTO) -> int:
        """Count companies matching filters."""
        repo_filters = FilterParams(**filters.to_count_params())
        return await self.company_repo.count_companies(filters=repo_filters, sort_by=filters.sort_by)

    async def get_company_with_accounting(self, orgnr: str) -> models.Company | None:
        """Fetch company by orgnr with financials eager loaded. Falls back to subunit lookup if main fails."""
        try:
            return await self.company_repo.get_by_orgnr(orgnr)
        except Exception:
            # Fallback for metadata/internal lookups. Returns None instead of raising.
            # This prevents 404 crashes in routes that expect a company but get a subunit.
            return await self.get_company_detail(orgnr)

    async def get_company_detail(self, orgnr: str) -> models.Company | Any | None:
        """Get enriched company details with parent name lookup and subunit fallback."""
        company: models.Company | dict[str, Any] | None
        try:
            company = await self.company_repo.get_by_orgnr(orgnr)
        except Exception:
            # Fallback to subunit lookup if not found in main company table
            subunit = await self.subunit_repo.get_by_orgnr(orgnr)
            if not subunit:
                return None

            # Map SubUnit to a Company-compatible dictionary for Pydantic
            # This allows the frontend to open sub-units in the same Modal
            logger.info(f"Using SubUnit fallback for {orgnr}")
            # Map to dict for Pydantic (will be validated by CompanyWithAccounting)
            comp_dict: dict[str, Any] = {
                "orgnr": subunit.orgnr,
                "navn": subunit.navn,
                "parent_orgnr": subunit.parent_orgnr,
                "organisasjonsform": subunit.organisasjonsform,
                "naeringskode": subunit.naeringskode,
                "antall_ansatte": subunit.antall_ansatte,
                "stiftelsesdato": subunit.stiftelsesdato,
                "registreringsdato_enhetsregisteret": subunit.registreringsdato_enhetsregisteret,
                "forretningsadresse": subunit.beliggenhetsadresse or subunit.postadresse,
                "postadresse": subunit.postadresse,
                "raw_data": subunit.raw_data,
                "regnskap": [],  # Subunits don't have their own accounting in Brreg
                "underenheter": [],
                "roller": [],
                "is_subunit": True,  # Flag for frontend to show slightly different UI
            }
            company = comp_dict

        if not company:
            return None

        # Fetch parent name efficiently if this is a subunit or a "promoted" subunit
        parent_orgnr = company.get("parent_orgnr") if isinstance(company, dict) else company.parent_orgnr
        if parent_orgnr:
            parent_name = await parent_name_cache.get(parent_orgnr)
            if parent_name:
                if isinstance(company, dict):
                    company["parent_navn"] = parent_name
                else:
                    setattr(company, "parent_navn", parent_name)
            else:
                try:
                    # Optimized column-only lookup
                    parent_name = await self.company_repo.get_company_name(parent_orgnr)
                    if parent_name:
                        if isinstance(company, dict):
                            company["parent_navn"] = parent_name
                        else:
                            setattr(company, "parent_navn", parent_name)
                        await parent_name_cache.set(parent_orgnr, parent_name)
                    else:
                        asyncio.create_task(self._background_parent_sync(parent_orgnr))
                except Exception:
                    pass

        # Auto-geocode if needed (for Companies)
        if not isinstance(company, dict) and company.latitude is None:
            await self.ensure_geocoded(company)

        return company

    async def _background_parent_sync(self, parent_orgnr: str) -> None:
        """Deduplicated background sync for missing parent companies."""
        if parent_orgnr in self._syncing_orgnrs:
            return
        try:
            self._syncing_orgnrs.add(parent_orgnr)
            logger.info(f"Background sync: {parent_orgnr}")
            await self.fetch_and_store_company(parent_orgnr, fetch_financials=True)
        except Exception as e:
            logger.error(f"Sync failed for {parent_orgnr}: {e}")
        finally:
            self._syncing_orgnrs.discard(parent_orgnr)

    async def get_similar_companies(self, orgnr: str, limit: int = 5) -> list[CompanyWithFinancials]:
        """Find similar companies in proximity."""
        results = await self.company_repo.get_similar_companies(orgnr, limit)
        await self._enrich_nace_codes(results)
        return results

    async def get_aggregate_stats(self, filters: CompanyFilterDTO) -> dict[str, Any]:
        """Fetch cached aggregate statistics."""
        params = filters.to_count_params()
        if filters.sort_by:
            params["sort_by"] = filters.sort_by

        cache_key = hashlib.md5(str(sorted(params.items())).encode()).hexdigest()
        cached = await stats_cache.get(cache_key)
        if cached:
            return cached

        repo_filters = FilterParams(**filters.to_count_params())
        result = await self.company_repo.get_aggregate_stats(filters=repo_filters, sort_by=filters.sort_by)
        if result:
            await stats_cache.set(cache_key, result)
        return result or {"total_count": 0}

    async def get_companies_by_industry(
        self, nace_code: str, page: int = 1, limit: int = 20, include_inactive: bool = False
    ) -> dict[str, Any]:
        """Get paginated companies in an industry."""
        offset = (page - 1) * limit
        companies, total = await self.company_repo.get_by_industry_code(nace_code, limit, offset, include_inactive)
        await self._enrich_nace_codes(companies)
        total_pages = (total + limit - 1) // limit if total > 0 else 0
        return {
            "items": companies,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": total_pages,
            "nace_code": nace_code,
            "has_more": page < total_pages,
        }

    async def search_companies(self, name: str, limit: int = 10) -> list[CompanyWithFinancials]:
        """Full-text search for companies."""
        cache_key = f"search_{name}_{limit}"
        cached = await search_cache.get(cache_key)
        if cached:
            return cached

        results = await self.company_repo.search_by_name(name, limit)
        await self._enrich_nace_codes(results)
        await search_cache.set(cache_key, results)
        return results

    async def search_subunits(self, query: str, limit: int = 10) -> list[models.SubUnit]:
        """Fuzzy search for subunits."""
        return await self.subunit_repo.search_by_name(query, limit)

    async def get_subunits(self, parent_orgnr: str, force_refresh: bool = False) -> list[models.SubUnit]:
        """Get subunits for a company, syncing if missing."""
        if force_refresh:
            await self._sync_subunits_from_api(parent_orgnr)
        subunits = await self.subunit_repo.get_by_parent_orgnr(parent_orgnr)
        if not subunits and not force_refresh:
            await self._sync_subunits_from_api(parent_orgnr)
            subunits = await self.subunit_repo.get_by_parent_orgnr(parent_orgnr)
        return subunits

    async def fetch_and_store_company(
        self, orgnr: str, fetch_financials: bool = True, geocode: bool = True
    ) -> dict[str, Any]:
        """Fetch from Brreg and upsert into database."""
        result: dict[str, Any] = {"orgnr": orgnr, "company_fetched": False, "financials_fetched": 0, "errors": []}
        try:
            data = await self.brreg_api.fetch_company(orgnr)
            if not data:
                result["errors"].append("Not found in Brreg")
                return result

            company = await self.company_repo.create_or_update(data, autocommit=True)
            result["company_fetched"] = True
            await self._sync_subunits_from_api(orgnr)

            with contextlib.suppress(Exception):
                from services.role_service import RoleService

                await RoleService(self.db).get_roles(orgnr, force_refresh=True)

            if fetch_financials:
                statements = await self.brreg_api.fetch_financial_statements(orgnr)
                if statements:
                    for s in statements:
                        await self.accounting_repo.create_or_update(orgnr, s, raw_data=s)
                    await self.company_repo.update_last_polled_regnskap(orgnr)
                    await self.db.commit()
                    result["financials_fetched"] = len(statements)

            if geocode and company.latitude is None:
                await self.ensure_geocoded(company)
        except Exception as e:
            result["errors"].append(str(e))
        return result

    async def ensure_geocoded(self, company: models.Company) -> None:
        """Geocode company if missing coordinates."""
        addr_str = self.geocoding_service.build_address_string(
            company.forretningsadresse or {}, company.postadresse or {}
        )
        if addr_str:
            coords = await self.geocoding_service.geocode_address(addr_str, orgnr=company.orgnr)
            if coords:
                await self.company_repo.update_coordinates(company.orgnr, coords[0], coords[1])

    async def _sync_subunits_from_api(self, parent_orgnr: str) -> None:
        """Internal helper to sync subunits."""
        try:
            data = await self.brreg_api.fetch_subunits(parent_orgnr)
            if data:
                subunits = [models.SubUnit(**s, parent_orgnr=parent_orgnr) for s in data]
                await self.subunit_repo.create_batch(subunits)
        except Exception as e:
            logger.warning(f"Subunit sync failed: {e}")

    async def _enrich_nace_codes(self, items: Any) -> None:
        """Enrich NACE codes with descriptions."""
        nace = NaceService(self.db)
        for item in items:
            # Handle both objects and dicts (for compatibility with existing tests)
            is_dict = isinstance(item, dict)

            # Enrich primary NACE
            primary_code = item.get("naeringskode") if is_dict else getattr(item, "naeringskode", None)
            if primary_code and isinstance(primary_code, str):
                name = await nace.get_nace_name(primary_code)
                enriched = Naeringskode(kode=primary_code, beskrivelse=name)
                if is_dict:
                    item["naeringskode"] = enriched
                else:
                    setattr(item, "naeringskode", enriched)

            # Enrich secondary NACEs
            secondary_codes = item.get("naeringskoder") if is_dict else getattr(item, "naeringskoder", None)
            if secondary_codes and isinstance(secondary_codes, list):
                enriched_list = []
                for c in secondary_codes:
                    if isinstance(c, str):
                        name = await nace.get_nace_name(c)
                        enriched_list.append(Naeringskode(kode=c, beskrivelse=name))
                    else:
                        enriched_list.append(c)

                if is_dict:
                    item["naeringskoder"] = enriched_list
                else:
                    setattr(item, "naeringskoder", enriched_list)

    async def get_statistics(self) -> dict[str, Any]:
        """Get high-level platform statistics with fast-path optimization."""
        try:
            # Attempt fast path using the materialized view
            agg_stats = await self.get_aggregate_stats(CompanyFilterDTO())
            total_companies = agg_stats.get("total_count", 0)
            total_employees = agg_stats.get("total_employees", 0)

            # If view is empty or failed, use fast count estimate
            if total_companies == 0:
                total_companies = await self.company_repo.count(fast=True)
                total_employees = await self.company_repo.get_total_employees()
        except Exception:
            # Fallback to direct count if aggregate stats fails
            total_companies = await self.company_repo.count(fast=True)
            total_employees = await self.company_repo.get_total_employees()

        # Concurrent fetching of additional stats
        results = await asyncio.gather(
            self.accounting_repo.get_aggregated_stats(),
            self.company_repo.get_geocoded_count(),
            self.company_repo.get_new_companies_30d(),
            self.role_repo.count_total_roles(),
            return_exceptions=True,
        )

        financial_stats = results[0] if not isinstance(results[0], Exception) else {}
        geocoded_count = results[1] if not isinstance(results[1], Exception) else 0
        new_companies_30d = results[2] if not isinstance(results[2], Exception) else 0
        total_roles = results[3] if not isinstance(results[3], Exception) else 0

        return {
            "total_companies": total_companies,
            "total_employees": total_employees,
            "geocoded_count": geocoded_count,
            "new_companies_30d": new_companies_30d,
            "total_roles": total_roles,
            **(financial_stats if isinstance(financial_stats, dict) else {}),
        }
