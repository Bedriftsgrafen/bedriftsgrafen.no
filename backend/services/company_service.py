import asyncio
import contextlib
import hashlib
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

import models
from repositories.accounting_repository import AccountingRepository
from repositories.company_filter_builder import FilterParams
from repositories.company import CompanyRepository, CompanyWithFinancials
from repositories.subunit_repository import SubUnitRepository
from services.brreg_api_service import BrregApiService
from services.dtos import CompanyFilterDTO
from services.geocoding_service import GeocodingService
from utils.cache import AsyncLRUCache

logger = logging.getLogger(__name__)

# Module-level cache shared across service instances
search_cache = AsyncLRUCache(maxsize=500, ttl=60)
stats_cache = AsyncLRUCache(maxsize=100, ttl=60)  # 60s cache for stats

# Lock to prevent thundering herd on stats computation
_stats_lock = asyncio.Lock()


class CompanyService:
    def __init__(self, db: AsyncSession):
        self.db = db  # Store for geocoding updates
        self.company_repo = CompanyRepository(db)
        self.accounting_repo = AccountingRepository(db)
        self.subunit_repo = SubUnitRepository(db)
        self.brreg_api = BrregApiService()
        self.geocoding_service = GeocodingService()
        # NOTE: cache is module-level (see below) so it's shared across
        # CompanyService instances.

    async def get_companies(self, filters: CompanyFilterDTO) -> list[CompanyWithFinancials]:
        """Get companies with filters using DTO pattern

        Args:
            filters: CompanyFilterDTO with all filter parameters

        Returns:
            List of Company models matching filters
        """
        repo_filters = FilterParams(**filters.to_count_params())
        return await self.company_repo.get_all(
            filters=repo_filters,
            skip=filters.skip,
            limit=filters.limit,
            sort_by=filters.sort_by,
            sort_order=filters.sort_order,
        )

    async def stream_companies(self, filters: CompanyFilterDTO):
        """Stream companies from repository using generator.

        Yields:
            Company models one by one
        """
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
        """Count companies matching filters using DTO pattern

        Args:
            filters: CompanyFilterDTO with all filter parameters

        Returns:
            Count of companies matching filters
        """
        repo_filters = FilterParams(**filters.to_count_params())
        return await self.company_repo.count_companies(filters=repo_filters, sort_by=filters.sort_by)

    async def get_company_with_accounting(self, orgnr: str) -> models.Company | None:
        return await self.company_repo.get_by_orgnr(orgnr)

    async def get_similar_companies(self, orgnr: str, limit: int = 5) -> list[models.Company]:
        """Get similar companies based on industry and location."""
        return await self.company_repo.get_similar_companies(orgnr, limit)

    async def get_aggregate_stats(self, filters: CompanyFilterDTO) -> dict[str, Any]:
        """Get aggregate statistics for companies matching filters.

        Args:
            filters: CompanyFilterDTO with all filter parameters

        Returns:
            Dictionary with total_count, total_revenue, total_profit,
            total_employees, and by_organisasjonsform breakdown
        """
        # Create cache key from filter params AND sort_by
        # (Since sort_by can affect joining behavior and thus the resulting count/stats)
        params = filters.to_count_params()
        if filters.sort_by:
            params["sort_by"] = filters.sort_by

        cache_key = hashlib.md5(str(sorted(params.items())).encode()).hexdigest()

        # Check cache
        cached = await stats_cache.get(cache_key)
        if cached is not None:
            logger.debug(f"Stats cache hit for key {cache_key[:8]}")
            return cached

        # Compute and cache (only cache valid results with data)
        repo_filters = FilterParams(**filters.to_count_params())
        result = await self.company_repo.get_aggregate_stats(filters=repo_filters, sort_by=filters.sort_by)

        # Handle None result (edge case when query returns no data)
        if result is None:
            result = {
                "total_count": 0,
                "total_revenue": 0,
                "total_profit": 0,
                "total_employees": 0,
                "by_organisasjonsform": {},
            }

        if result.get("total_count", 0) > 0 or result.get("by_organisasjonsform"):
            await stats_cache.set(cache_key, result)
            logger.debug(f"Stats cached for key {cache_key[:8]}")

        return result

    async def get_companies_by_industry(
        self, nace_code: str, page: int = 1, limit: int = 20, include_inactive: bool = False
    ) -> dict[str, Any]:
        """
        Get paginated list of companies in a specific industry.

        Args:
            nace_code: NACE code (e.g., "62.010" for exact, "62" for prefix match)
            page: Page number (1-indexed)
            limit: Items per page
            include_inactive: Include bankrupt/liquidating companies

        Returns:
            Dictionary with items, pagination metadata, and industry info
        """
        offset = (page - 1) * limit
        companies, total = await self.company_repo.get_by_industry_code(nace_code, limit, offset, include_inactive)

        # Calculate pagination metadata
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

    async def search_companies(self, name: str, limit: int = 20) -> list[dict[str, Any]]:
        # Normalize cache key
        key = f"{name.strip().lower()}|{limit}"
        cached = await search_cache.get(key)
        if cached is not None:
            return cached

        results = await self.company_repo.search_by_name(name, limit)
        # If repository returned None (DB error/timeout), don't cache — just
        # return an empty list so frontend gets a graceful response.
        if results is None:
            return []

        # Convert ORM instances to plain serializable dicts before caching.
        serializable = []
        for c in results:
            serializable.append(
                {
                    "orgnr": getattr(c, "orgnr", None),
                    "navn": getattr(c, "navn", None),
                    "organisasjonsform": getattr(c, "organisasjonsform", None),
                    "naeringskode": getattr(c, "naeringskode", None),
                }
            )

        # cache serializable result
        await search_cache.set(key, serializable)
        return serializable

    async def fetch_and_store_company(
        self, orgnr: str, fetch_financials: bool = True, geocode: bool = True
    ) -> dict[str, Any]:
        """
        Fetch company data from Brønnøysund and store it in the database

        Args:
            orgnr: Organization number (9 digits)
            fetch_financials: Whether to also fetch financial statements
            geocode: Whether to geocode the address (defaults to True)

        Returns:
            Dictionary with status and stored data info
        """
        result: dict[str, Any] = {
            "orgnr": orgnr,
            "company_fetched": False,
            "financials_fetched": 0,
            "errors": [],
        }

        # Fetch company data
        company_data = await self.brreg_api.fetch_company(orgnr)
        if company_data:
            try:
                await self.company_repo.create_or_update(company_data)
                result["company_fetched"] = True
                logger.info(f"Stored company data for {orgnr}")

                # Geocode address (async, non-blocking on failure)
                if geocode:
                    await self._geocode_company(orgnr, company_data)

            except Exception as e:
                error_msg = f"Error storing company {orgnr}: {str(e)}"
                logger.error(error_msg)
                # Provide user-friendly error messages
                if "statement timeout" in str(e).lower() or "querycancelederror" in str(e).lower():
                    result["errors"].append("Oppdatering tok for lang tid. Vennligst prøv igjen.")
                else:
                    result["errors"].append("Kunne ikke lagre bedriftsdata i databasen")
        else:
            result["errors"].append(f"Company {orgnr} not found in Enhetsregisteret")

        # Fetch financial statements if requested
        if fetch_financials and result["company_fetched"]:
            statements = await self.brreg_api.fetch_financial_statements(orgnr)

            for statement in statements:
                try:
                    parsed_data = await self.brreg_api.parse_financial_data(statement)

                    if parsed_data.get("aar"):
                        await self.accounting_repo.create_or_update(orgnr, parsed_data, statement)
                        result["financials_fetched"] += 1
                        logger.info(f"Stored financial data for {orgnr}, year {parsed_data['aar']}")
                except Exception as e:
                    error_msg = f"Error storing financial data for {orgnr}: {str(e)}"
                    logger.error(error_msg)
                    # Provide user-friendly error messages
                    if "generatedalwayserror" in str(e).lower():
                        result["errors"].append("Databasefeil: Kunne ikke lagre regnskapsdata")
                    else:
                        result["errors"].append("Kunne ikke lagre regnskapsdata")

        return result

    async def _geocode_company(self, orgnr: str, company_data: dict) -> None:
        """
        Geocode a company's address and store coordinates.
        Non-blocking: failures are logged but don't stop the main flow.
        """
        try:
            # Build address string from company data
            forretningsadresse = company_data.get("forretningsadresse", {})
            postadresse = company_data.get("postadresse", {})

            address_str = GeocodingService.build_address_string(forretningsadresse, postadresse)
            if not address_str:
                return

            # Geocode via Kartverket API (handles overrides)
            coords = await self.geocoding_service.geocode_address(address_str, orgnr=orgnr)
            if not coords:
                return

            lat, lng = coords

            # Update company with coordinates
            await self.company_repo.update_coordinates(orgnr, lat, lng)

            logger.info(f"Geocoded {orgnr} -> ({lat:.5f}, {lng:.5f})")

        except Exception as e:
            logger.warning(f"Geocoding failed for {orgnr}: {e}")
            # Don't propagate - geocoding failure shouldn't break fetch flow

    async def ensure_geocoded(self, company: models.Company) -> None:
        """
        Geocode company if coordinates are missing.
        Updates the company object in-place and saves to DB.
        """
        try:
            if company.latitude is not None and company.longitude is not None:
                return

            # Build address string
            address_str = GeocodingService.build_address_string(
                company.forretningsadresse or {}, company.postadresse or {}
            )

            if not address_str:
                return

            # Geocode (handles overrides)
            coords = await self.geocoding_service.geocode_address(address_str, orgnr=company.orgnr)
            if not coords:
                return

            lat, lng = coords

            # Update DB
            await self.company_repo.update_coordinates(company.orgnr, lat, lng)

            # Update object in place so response includes new coords
            company.latitude = lat
            company.longitude = lng
            company.geocoded_at = datetime.now(timezone.utc)

            logger.info(f"Geocoded on-demand {company.orgnr} -> ({lat:.5f}, {lng:.5f})")

        except Exception as e:
            logger.warning(f"On-demand geocoding failed for {company.orgnr}: {e}")

    async def get_statistics(self) -> dict:
        # Check cache first (cache key "dashboard_stats")
        cached_stats = await search_cache.get("dashboard_stats")
        if cached_stats:
            return cached_stats

        # Prevent thundering herd - only one computation at a time
        async with _stats_lock:
            # Double-check cache after acquiring lock
            cached_stats = await search_cache.get("dashboard_stats")
            if cached_stats:
                return cached_stats

            # Fast queries using pg_class estimates and indices
            total_companies = await self.company_repo.count()
            total_reports = await self.accounting_repo.count()

            # Financial stats from materialized view (should be fast)
            financial_stats = await self.accounting_repo.get_aggregated_stats()

            # These queries can be slow - run with timeout
            try:
                total_employees = await asyncio.wait_for(self.company_repo.get_total_employees(), timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning("get_total_employees timed out, using cached/estimated value")
                total_employees = 0

            try:
                new_companies_ytd = await asyncio.wait_for(self.company_repo.get_new_companies_ytd(), timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning("get_new_companies_ytd timed out, using cached/estimated value")
                new_companies_ytd = 0

            try:
                bankruptcies = await asyncio.wait_for(self.company_repo.get_bankruptcies_count(), timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning("get_bankruptcies_count timed out, using cached/estimated value")
                bankruptcies = 0

            stats = {
                "total_companies": total_companies,
                "total_accounting_reports": total_reports,
                "total_revenue": financial_stats["total_revenue"],
                "total_employees": total_employees,
                "profitable_percentage": financial_stats["profitable_percentage"],
                "avg_operating_margin": financial_stats["avg_operating_margin"],
                "new_companies_ytd": new_companies_ytd,
                "bankruptcies": bankruptcies,
            }

            # Cache for 1 hour (3600 seconds)
            await search_cache.set("dashboard_stats", stats, ttl=3600)

            return stats

    async def get_subunits(self, parent_orgnr: str, force_refresh: bool = False) -> list[models.SubUnit]:
        """
        Get subunits (underenheter) for a parent company.
        Uses lazy-loading: checks DB first, fetches from API if not found.

        Args:
            parent_orgnr: Parent company organization number
            force_refresh: If True, fetch from API even if DB has data

        Returns:
            List of SubUnit models
        """
        # If force refresh, delete existing and fetch new
        if force_refresh:
            await self.subunit_repo.delete_by_parent_orgnr(parent_orgnr)

        # Check database first
        subunits = await self.subunit_repo.get_by_parent_orgnr(parent_orgnr)

        # If found in DB and not forcing refresh, return cached data
        if subunits and not force_refresh:
            logger.debug(f"Found {len(subunits)} subunits in DB for {parent_orgnr}")
            return subunits

        # Fetch from API
        logger.info(f"Fetching subunits from API for {parent_orgnr}")
        try:
            api_subunits = await self.brreg_api.fetch_subunits(parent_orgnr)

            if not api_subunits:
                logger.info(f"No subunits found for {parent_orgnr}")
                return []

            # Parse and create SubUnit models
            new_subunits = []
            for item in api_subunits:
                try:
                    # Validate required fields
                    orgnr = item.get("organisasjonsnummer")
                    navn = item.get("navn")

                    if not orgnr or not navn:
                        logger.warning(
                            f"Skipping subunit with missing required fields: {item.get('organisasjonsnummer', 'unknown')}"
                        )
                        continue

                    # Extract founding date
                    stiftelsesdato = None
                    if "stiftelsesdato" in item:
                        with contextlib.suppress(ValueError, TypeError):
                            stiftelsesdato = datetime.strptime(item["stiftelsesdato"], "%Y-%m-%d").date()

                    subunit = models.SubUnit(
                        orgnr=orgnr,
                        navn=navn,
                        organisasjonsform=item.get("organisasjonsform", {}).get("kode")
                        if isinstance(item.get("organisasjonsform"), dict)
                        else None,
                        parent_orgnr=parent_orgnr,
                        beliggenhetsadresse=item.get("beliggenhetsadresse"),
                        postadresse=item.get("postadresse"),
                        antall_ansatte=item.get("antallAnsatte") or 0,
                        naeringskode=item.get("naeringskode1", {}).get("kode")
                        if isinstance(item.get("naeringskode1"), dict)
                        else None,
                        stiftelsesdato=stiftelsesdato,
                    )
                    new_subunits.append(subunit)
                except Exception as e:
                    logger.error(f"Error parsing subunit data: {e}", exc_info=True)
                    continue

            # Batch save to database
            if new_subunits:
                saved_count = await self.subunit_repo.create_batch(new_subunits)
                logger.info(f"Saved {saved_count}/{len(new_subunits)} subunits for {parent_orgnr}")
                return new_subunits
            else:
                return []

        except Exception as e:
            logger.error(f"Error fetching/storing subunits for {parent_orgnr}: {e}", exc_info=True)
            # Return DB data as fallback if API fails
            return subunits if subunits else []

    async def search_subunits(self, query: str, limit: int = 50) -> list[models.SubUnit]:
        """
        Fuzzy search for subunits by name using trigram similarity.

        Args:
            query: Search query (minimum 2 characters)
            limit: Maximum number of results (default 50, max 500)

        Returns:
            List of SubUnit objects matching the query, sorted by similarity
        """
        return await self.subunit_repo.search_by_name(query, limit)
