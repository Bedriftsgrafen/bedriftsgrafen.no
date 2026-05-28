import asyncio
import hashlib
import logging
import os
import time
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models
from constants.concurrency import (
    PARENT_NAME_CACHE_SIZE,
    PARENT_NAME_CACHE_TTL,
    SEARCH_CACHE_SIZE,
    SEARCH_CACHE_TTL,
)
from database import AsyncSessionLocal
from exceptions import ValidationException
from repositories.accounting_repository import AccountingRepository
from repositories.company import CompanyRepository, CompanyWithFinancials
from repositories.company_event_repository import CompanyEventRepository
from repositories.company_filter_builder import FilterParams
from repositories.role_repository import RoleRepository
from repositories.subunit_repository import SubUnitRepository
from schemas.companies import AccountingWithKpis, MapMarker, Naeringskode
from services.base_external_service import ExternalApiException
from services.brreg_api_service import BrregApiService
from services.brreg_mappers import map_subunit_from_api
from services.dtos import CompanyFilterDTO
from services.geocoding_service import GeocodingService
from services.kpi_service import KpiService
from services.nace_service import NaceService
from utils.cache import AsyncLRUCache
from utils.logging_config import sanitize_log
from utils.redis_cache import RedisCache

logger = logging.getLogger(__name__)


def _read_similar_slow_threshold_ms() -> int:
    """Read slow-log threshold for similar endpoint from env.

    Falls back to 2000 ms for missing/invalid values.
    """
    raw = os.getenv("SIMILAR_SLOW_LOG_THRESHOLD_MS", "2000")
    try:
        return max(0, int(raw))
    except ValueError:
        return 2000


# Module-level cache shared across service instances
search_cache = AsyncLRUCache(maxsize=SEARCH_CACHE_SIZE, ttl=SEARCH_CACHE_TTL)
similar_cache = AsyncLRUCache(maxsize=500, ttl=300)  # 5-min cache for similar companies
# In-flight coalescing: if two coroutines request the same key simultaneously, the
# second awaits the first's Task instead of firing a duplicate DB query.
_similar_in_flight: dict[str, asyncio.Task[list[CompanyWithFinancials]]] = {}
# Redis-backed caches: shared across all uvicorn workers, 5-min TTL
stats_cache = RedisCache(prefix="stats:aggregate", ttl=300)
count_cache = RedisCache(prefix="stats:count", ttl=300)
parent_name_cache = AsyncLRUCache(
    maxsize=PARENT_NAME_CACHE_SIZE, ttl=PARENT_NAME_CACHE_TTL
)  # 1h cache for parent names
SIMILAR_SLOW_LOG_THRESHOLD_MS = _read_similar_slow_threshold_ms()

# Lock to prevent thundering herd on stats computation
_stats_lock = asyncio.Lock()


class CompanyService:
    # Class-level set to track active sync tasks across service instances
    _syncing_orgnrs: set[str] = set()
    _background_tasks: set[asyncio.Task[None]] = set()

    def __init__(self, db: AsyncSession):
        self.db = db
        self.company_repo = CompanyRepository(db)
        self.accounting_repo = AccountingRepository(db)
        self.event_repo = CompanyEventRepository(db)
        self.role_repo = RoleRepository(db)
        self.subunit_repo = SubUnitRepository(db)
        self.brreg_api = BrregApiService()
        self.geocoding_service = GeocodingService()
        self.event_ledger_enabled = os.getenv("ENABLE_COMPANY_EVENT_LEDGER", "").lower() in {"1", "true", "yes"}

    @staticmethod
    def _parse_date_as_datetime(value: Any) -> datetime | None:
        if not value:
            return None
        try:
            parsed_date = date.fromisoformat(str(value))
        except ValueError:
            return None
        return datetime.combine(parsed_date, datetime.min.time(), tzinfo=UTC)

    async def _record_accounting_added_event_safe(
        self,
        *,
        orgnr: str,
        statement: dict[str, Any],
        parsed: dict[str, Any],
    ) -> None:
        if not self.event_ledger_enabled:
            return

        try:
            async with self.db.begin_nested():
                await self.event_repo.record_event(
                    orgnr=orgnr,
                    event_type="accounting_added",
                    source="Regnskapsregisteret via Brreg",
                    source_update_id=str(
                        statement.get("id")
                        or statement.get("journalnr")
                        or f"{orgnr}:{parsed.get('aar')}:{parsed.get('periode_til')}"
                    ),
                    occurred_at=self._parse_date_as_datetime(parsed.get("periode_til")),
                    new_value={
                        "aar": parsed.get("aar"),
                        "periode_til": parsed.get("periode_til"),
                    },
                    payload={
                        "journalnr": statement.get("journalnr"),
                        "time_semantics": "Regnskapsperiode når tilgjengelig; observert tidspunkt er Bedriftsgrafens importtid.",
                    },
                )
        except Exception:
            logger.exception(
                "Failed to record accounting event",
                extra={"orgnr": sanitize_log(orgnr), "event_type": "accounting_added"},
            )

    @staticmethod
    def _accounting_sort_key(accounting: Any) -> tuple[int, int, date, date, int]:
        def get_value(name: str, default: Any = None) -> Any:
            if isinstance(accounting, dict):
                return accounting.get(name, default)
            return getattr(accounting, name, default)

        period_metadata_score = int(get_value("periode_fra") is not None) + int(get_value("periode_til") is not None)

        return (
            get_value("aar", 0) or 0,
            period_metadata_score,
            get_value("periode_til") or date.min,
            get_value("periode_fra") or date.min,
            get_value("id", 0) or 0,
        )

    @classmethod
    def _sort_accounting_history(cls, accountings: list[Any]) -> list[Any]:
        return sorted(accountings, key=cls._accounting_sort_key, reverse=True)

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
        await self.enrich_nace_codes(results)
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
        """Count companies matching filters with Redis caching."""
        params = filters.to_count_params()
        if filters.sort_by:
            params["sort_by"] = filters.sort_by
        cache_key = hashlib.sha256(str(sorted(params.items())).encode()).hexdigest()

        cached = await count_cache.get(cache_key)
        if cached is not None:
            return int(cached)

        repo_filters = FilterParams(**filters.to_count_params())
        result = await self.company_repo.count_companies(filters=repo_filters, sort_by=filters.sort_by)
        await count_cache.set(cache_key, result)
        return result

    async def get_company_with_accounting(self, orgnr: str) -> models.Company | None:
        """Fetch company by orgnr with financials eager loaded. Falls back to subunit lookup if main fails."""
        try:
            return await self.company_repo.get_by_orgnr(orgnr)
        except Exception:
            logger.warning(
                "get_by_orgnr failed for %s, falling back to subunit lookup", sanitize_log(orgnr), exc_info=True
            )
            return await self.get_company_detail(orgnr)

    async def get_company_detail(self, orgnr: str) -> models.Company | Any | None:
        """Get enriched company details with parent name lookup and subunit fallback."""
        company: models.Company | dict[str, Any] | None
        try:
            company = await self.company_repo.get_by_orgnr(orgnr)
        except Exception:
            logger.warning("get_by_orgnr failed for %s, trying subunit fallback", sanitize_log(orgnr), exc_info=True)
            subunit = await self.subunit_repo.get_by_orgnr(orgnr)
            if not subunit:
                logger.debug("company.get_detail.both_lookups_failed", extra={"orgnr": sanitize_log(orgnr)})
                return None

            # Map SubUnit to a Company-compatible dictionary for Pydantic
            # This allows the frontend to open sub-units in the same Modal
            logger.info("Using SubUnit fallback for %s", sanitize_log(orgnr))
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
            logger.debug("company.get_detail.not_found", extra={"orgnr": sanitize_log(orgnr)})
            return None

        # Fetch parent name efficiently if this is a subunit or a "promoted" subunit
        parent_orgnr = company.get("parent_orgnr") if isinstance(company, dict) else company.parent_orgnr
        if parent_orgnr:
            parent_name = await parent_name_cache.get(parent_orgnr)
            if parent_name:
                if isinstance(company, dict):
                    company["parent_navn"] = parent_name
                else:
                    setattr(company, "parent_navn", parent_name)  # noqa: B010  -- dynamic attr on ORM model
            else:
                try:
                    # Optimized column-only lookup
                    parent_name = await self.company_repo.get_company_name(parent_orgnr)
                    if parent_name:
                        if isinstance(company, dict):
                            company["parent_navn"] = parent_name
                        else:
                            setattr(company, "parent_navn", parent_name)  # noqa: B010  -- dynamic attr on ORM model
                        await parent_name_cache.set(parent_orgnr, parent_name)
                    else:
                        _task = asyncio.create_task(self._background_parent_sync(parent_orgnr))
                        CompanyService._background_tasks.add(_task)
                        _task.add_done_callback(CompanyService._background_tasks.discard)
                except Exception:
                    logger.debug(f"Parent name lookup failed for {parent_orgnr}", exc_info=True)

        # Auto-geocode if needed (for Companies)
        if not isinstance(company, dict) and company.latitude is None:
            await self.ensure_geocoded(company)

        # Enrich NACE codes before returning
        await self.enrich_nace_codes([company])

        if isinstance(company, dict):
            company["regnskap"] = self._sort_accounting_history(company.get("regnskap") or [])
        else:
            accountings = getattr(company, "regnskap", None)
            if isinstance(accountings, list):
                accountings[:] = self._sort_accounting_history(list(accountings))

        return company

    async def _background_parent_sync(self, parent_orgnr: str) -> None:
        """Deduplicated background sync for missing parent companies.

        Uses its own DB session because this runs as a background task
        after the original request's session may already be closed.
        """
        if parent_orgnr in self._syncing_orgnrs:
            return
        try:
            self._syncing_orgnrs.add(parent_orgnr)
            logger.info(f"Background sync: {parent_orgnr}")
            async with AsyncSessionLocal() as bg_session:
                bg_service = CompanyService(bg_session)
                await bg_service.fetch_and_store_company(parent_orgnr, fetch_financials=True)
        except Exception as e:
            logger.error(f"Sync failed for {parent_orgnr}: {e}")
        finally:
            self._syncing_orgnrs.discard(parent_orgnr)

    async def get_similar_companies(self, orgnr: str, limit: int = 5) -> list[CompanyWithFinancials]:
        """Find similar companies in proximity. Results are cached for 5 minutes.

        Uses in-flight coalescing: concurrent requests for the same key within the
        same worker share one DB query instead of each firing their own.
        """
        started = time.perf_counter()
        cache_hit = False
        coalesced_inflight = False
        result_count = 0
        cache_key = f"{orgnr}:{limit}"
        try:
            cached = await similar_cache.get(cache_key)
            if cached is not None:
                cache_hit = True
                result_count = len(cached)
                return cached

            # Coalesce concurrent requests for the same key within this worker.
            if cache_key in _similar_in_flight:
                coalesced_inflight = True
                coalesced_results = await _similar_in_flight[cache_key]
                result_count = len(coalesced_results)
                return coalesced_results

            async def _fetch() -> list[CompanyWithFinancials]:
                try:
                    results = await self.company_repo.get_similar_companies(orgnr, limit)
                    await self.enrich_nace_codes(results)
                    await similar_cache.set(cache_key, results)
                    return results
                finally:
                    _similar_in_flight.pop(cache_key, None)

            task: asyncio.Task[list[CompanyWithFinancials]] = asyncio.create_task(_fetch())
            _similar_in_flight[cache_key] = task
            results = await task
            result_count = len(results)
            return results
        finally:
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            if elapsed_ms >= SIMILAR_SLOW_LOG_THRESHOLD_MS:
                logger.warning(
                    "similar.companies.slow orgnr=%s limit=%s duration_ms=%d cache_hit=%s coalesced_inflight=%s result_count=%d",
                    sanitize_log(orgnr),
                    limit,
                    elapsed_ms,
                    cache_hit,
                    coalesced_inflight,
                    result_count,
                )

    async def get_aggregate_stats(self, filters: CompanyFilterDTO) -> dict[str, Any]:
        """Fetch cached aggregate statistics."""
        params = filters.to_count_params()
        if filters.sort_by:
            params["sort_by"] = filters.sort_by

        cache_key = hashlib.sha256(str(sorted(params.items())).encode()).hexdigest()
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
        await self.enrich_nace_codes(companies)
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
        normalized_name = name.strip()
        cache_key = f"search_{normalized_name.lower()}_{limit}"
        cached = await search_cache.get(cache_key)
        if cached:
            return cached

        results = await self.company_repo.search_by_name(normalized_name, limit)
        await self.enrich_nace_codes(results)
        await search_cache.set(cache_key, results)
        return results

    async def search_subunits(self, query: str, limit: int = 10) -> list[models.SubUnit]:
        """Fuzzy search for subunits."""
        return await self.subunit_repo.search_by_name(query, limit)

    async def get_subunits(self, parent_orgnr: str, force_refresh: bool = False) -> list[models.SubUnit]:
        """Get subunits for a company, syncing if missing."""
        if force_refresh:
            await self._sync_subunits_from_api(parent_orgnr, raise_errors=True)
        subunits = await self.subunit_repo.get_by_parent_orgnr(parent_orgnr)
        if not subunits and not force_refresh:
            await self._sync_subunits_from_api(parent_orgnr)
            subunits = await self.subunit_repo.get_by_parent_orgnr(parent_orgnr)
        return subunits

    async def fetch_and_store_company(
        self, orgnr: str, fetch_financials: bool = True, geocode: bool = True
    ) -> dict[str, Any]:
        """Fetch from Brreg and upsert into database."""
        result: dict[str, Any] = {
            "orgnr": orgnr,
            "company_fetched": False,
            "financials_fetched": 0,
            "financials_skipped": 0,
            "error_code": None,
            "errors": [],
        }

        def _append_error(message: str, error_code: str | None = None) -> None:
            if error_code and result["error_code"] is None:
                result["error_code"] = error_code
            errors = result["errors"]
            if len(errors) < 5:
                errors.append(message)
                return
            overflow_message = "Flere feil oppstod under datainnhenting. Sjekk logger for detaljer."
            if overflow_message not in errors:
                errors.append(overflow_message)

        try:
            try:
                data = await self.brreg_api.fetch_company(orgnr)
            except ExternalApiException as e:
                logger.warning(
                    "brreg.company_fetch_failed orgnr=%s status=%s details=%s",
                    sanitize_log(orgnr),
                    getattr(e, "status_code", None),
                    sanitize_log(e.details or e.message),
                )
                _append_error("Kunne ikke hente data fra Brønnøysundregistrene akkurat nå.", "BRREG_API_ERROR")
                return result

            if not data:
                _append_error("Virksomheten finnes ikke i Brønnøysundregistrene")
                return result

            company = await self.company_repo.create_or_update(data, autocommit=True)
            result["company_fetched"] = True
            await self._sync_subunits_from_api(orgnr)

            try:
                from services.role_service import RoleService

                await RoleService(self.db).get_roles(orgnr, force_refresh=True)
            except ExternalApiException as e:
                logger.warning(
                    "brreg.roles_prefetch_failed orgnr=%s status=%s details=%s",
                    sanitize_log(orgnr),
                    getattr(e, "status_code", None),
                    sanitize_log(e.details or e.message),
                )
            except Exception as e:
                logger.warning("roles.prefetch_failed orgnr=%s error=%s", sanitize_log(orgnr), sanitize_log(e))

            if fetch_financials:
                try:
                    statements = await self.brreg_api.fetch_financial_statements(orgnr)
                except ExternalApiException as e:
                    logger.warning(
                        "brreg.financials_fetch_failed orgnr=%s status=%s details=%s",
                        sanitize_log(orgnr),
                        getattr(e, "status_code", None),
                        sanitize_log(e.details or e.message),
                    )
                    _append_error("Kunne ikke hente regnskap fra Brønnøysund akkurat nå.", "BRREG_API_ERROR")
                except Exception:
                    logger.exception("financials.fetch_failed orgnr=%s", sanitize_log(orgnr))
                    _append_error("Kunne ikke hente regnskap fra Brønnøysund akkurat nå.")
                else:
                    saved_count = 0
                    skipped_count = 0
                    if statements:
                        for statement in statements:
                            try:
                                parsed = await self.brreg_api.parse_financial_data(statement)
                                if not parsed.get("aar"):
                                    raise ValidationException("Financial data must include accounting year (aar)")
                                await self.accounting_repo.create_or_update(orgnr, parsed, raw_data=statement)
                                await self._record_accounting_added_event_safe(
                                    orgnr=orgnr,
                                    statement=statement,
                                    parsed=parsed,
                                )
                                saved_count += 1
                            except ValidationException as e:
                                skipped_count += 1
                                logger.warning(
                                    "financials.statement_skipped orgnr=%s reason=%s",
                                    sanitize_log(orgnr),
                                    sanitize_log(e),
                                )
                                _append_error("Et regnskapspost manglet regnskapsår og ble hoppet over.")
                            except Exception as e:
                                skipped_count += 1
                                logger.error(
                                    "financials.statement_save_failed orgnr=%s error=%s", sanitize_log(orgnr), e
                                )
                                _append_error("Et regnskapspost kunne ikke lagres.")

                    if not statements or saved_count > 0:
                        await self.company_repo.update_last_polled_regnskap(orgnr)
                        await self.db.commit()

                    result["financials_fetched"] = saved_count
                    result["financials_skipped"] = skipped_count

            if geocode and company.latitude is None:
                await self.ensure_geocoded(company)
        except Exception:
            logger.exception("fetch_and_store_company failed orgnr=%s", sanitize_log(orgnr))
            _append_error("Noe gikk galt under henting av data. Prøv igjen.")
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

    async def _sync_subunits_from_api(self, parent_orgnr: str, raise_errors: bool = False) -> None:
        """Internal helper to sync subunits."""
        try:
            data = await self.brreg_api.fetch_subunits(parent_orgnr)
            if data:
                subunits = [map_subunit_from_api(s, parent_orgnr) for s in data]
                await self.subunit_repo.create_batch(subunits)
        except ExternalApiException:
            logger.warning("brreg.subunits_sync_failed parent_orgnr=%s", sanitize_log(parent_orgnr), exc_info=True)
            if raise_errors:
                raise
        except Exception as e:
            logger.warning("subunits.sync_failed parent_orgnr=%s error=%s", sanitize_log(parent_orgnr), sanitize_log(e))
            if raise_errors:
                raise

    async def enrich_nace_codes(self, items: list[Any]) -> None:
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
                    # Use instance dict to avoid overwriting the ORM column value
                    item.__dict__["_enriched_naeringskode"] = enriched

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
                    # Use instance dict to bypass the read-only @property
                    item.__dict__["_enriched_naeringskoder"] = enriched_list

    async def get_statistics(self) -> dict[str, int | float]:
        """Get high-level statistics for the landing page.

        PERFORMANCE OPTIMIZATION:
        Uses the consolidated 'company_totals' materialized view for sub-millisecond
        response time. This replaces 5+ sequential scans that previously took 26+ seconds.
        """
        try:
            stmt = select(models.CompanyTotals).where(models.CompanyTotals.id == 1)
            result = await self.db.execute(stmt)
            row = result.scalar_one_or_none()

            if not row:
                return {}

            return {
                "total_companies": row.total_count,
                "total_roles": row.total_roles,
                "total_employees": row.total_employees,
                "geocoded_count": row.geocoded_count,
                "new_companies_30d": row.new_companies_30d,
                "total_revenue": row.total_revenue,
                "total_ebitda": row.total_ebitda,
                "profitable_percentage": row.profitable_percentage,
                "solid_company_percentage": row.solid_company_percentage,
                "avg_operating_margin": row.avg_operating_margin,
            }
        except Exception as e:
            logger.error(f"Error fetching platform statistics: {e}", exc_info=True)
            return {}

    # ------------------------------------------------------------------
    # Accounting + KPIs — moved from router to follow Repo→Service→Router
    # ------------------------------------------------------------------

    async def get_accounting_with_kpis(self, orgnr: str, year: int) -> AccountingWithKpis | None:
        """Get accounting data for a specific year with calculated KPIs.

        Returns None if no accounting data found for the given orgnr+year.
        """
        accounting = await self.accounting_repo.get_by_orgnr_and_year(orgnr, year)

        if accounting is None:
            return None

        response = AccountingWithKpis.model_validate(accounting)
        response.kpis = KpiService.calculate_all_kpis(accounting)
        return response

    async def get_accounting_with_kpis_by_id(self, accounting_id: int, orgnr: str) -> AccountingWithKpis | None:
        """Get accounting data by record ID with calculated KPIs.

        Used by the frontend to fetch KPIs for a specific fiscal period,
        which is important for companies with split fiscal years (multiple
        records per calendar year).

        The orgnr parameter ensures the record belongs to the requested company,
        preventing cross-company data access via arbitrary IDs.
        """
        accounting = await self.accounting_repo.get_by_id(accounting_id, orgnr)

        if accounting is None:
            return None

        response = AccountingWithKpis.model_validate(accounting)
        response.kpis = KpiService.calculate_all_kpis(accounting)
        return response

    # ------------------------------------------------------------------
    # Map markers — moved from router to follow Repo→Service→Router
    # ------------------------------------------------------------------

    async def get_map_markers(
        self,
        filters: FilterParams,
        bbox: tuple[float, float, float, float] | None = None,
        limit: int = 5000,
    ) -> tuple[list[MapMarker], int]:
        """Get company markers for map display.

        Returns (markers_list, total_count).
        """
        rows, total = await self.company_repo.get_map_markers(filters=filters, bbox=bbox, limit=limit)

        markers = [
            MapMarker(
                orgnr=row[0],
                navn=row[1] or "",
                lat=row[2],
                lng=row[3],
                nace=row[4],
                ansatte=row[5],
            )
            for row in rows
        ]

        return markers, total
