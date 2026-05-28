import logging
import math
from collections.abc import Sequence
from datetime import date, datetime
from typing import Any

from sqlalchemy import case, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

import models
from exceptions import AccountingNotFoundException, DatabaseException, ValidationException

logger = logging.getLogger(__name__)


class AccountingRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _parse_date(date_str: str | None) -> date | None:
        """Parse ISO date string to date object."""
        if not date_str or len(date_str) < 10:
            return None
        try:
            return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        except ValueError, TypeError:
            logger.debug("accounting.date_parse_failed", extra={"raw": str(date_str)[:64]})
            return None

    @staticmethod
    def _validate_numeric(val: Any) -> float | None:
        """Convert to float and validate, return None if invalid (NaN/Infinity)."""
        if val is None:
            return None
        try:
            num = float(val)
            # Reject NaN and Infinity
            if not math.isfinite(num):
                logger.debug("accounting.non_finite_value", extra={"raw": str(val)[:32]})
                return None
            return num
        except ValueError, TypeError, OverflowError:
            logger.debug("accounting.numeric_parse_failed", extra={"raw": str(val)[:32]})
            return None

    @staticmethod
    def _calculate_gjeldsgrad(
        egenkapital: float | None, kortsiktig: float | None, langsiktig: float | None
    ) -> float | None:
        """Calculate debt ratio (gjeldsgrad) = total debt / equity."""
        if egenkapital is None or egenkapital == 0:
            return None
        total_gjeld = (kortsiktig or 0) + (langsiktig or 0)
        try:
            ratio = total_gjeld / egenkapital
            if not math.isfinite(ratio):
                return None
            return ratio
        except ZeroDivisionError, OverflowError:
            return None

    @staticmethod
    def _source_identity(raw_data: dict[str, Any] | None) -> tuple[str | None, str | None]:
        if not raw_data:
            return None, None
        source_id = raw_data.get("id")
        journalnr = raw_data.get("journalnr")
        return (
            str(source_id) if source_id is not None else None,
            str(journalnr) if journalnr is not None else None,
        )

    async def get_by_orgnr(self, orgnr: str) -> Sequence[models.Accounting]:
        """Get all accounting records for a company.

        Args:
            orgnr: Organization number

        Returns:
            List of accounting records ordered by year descending

        Raises:
            DatabaseException: If database error occurs
        """
        try:
            result = await self.db.execute(
                select(models.Accounting)
                .filter(models.Accounting.orgnr == orgnr)
                .order_by(models.Accounting.aar.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Database error fetching accounting for {orgnr}: {e}")
            raise DatabaseException(f"Failed to fetch accounting for {orgnr}", original_error=e)

    async def get_latest_financials_batch(self, orgnrs: list[str]) -> dict[str, models.LatestFinancials]:
        """Batch-fetch latest financials for a list of orgnrs.

        Uses the LatestFinancials materialized view for efficient access
        to pre-computed latest-year data per company.

        Args:
            orgnrs: List of organization numbers

        Returns:
            Dict mapping orgnr → LatestFinancials row
        """
        if not orgnrs:
            return {}
        try:
            stmt = select(models.LatestFinancials).where(models.LatestFinancials.orgnr.in_(orgnrs))
            result = await self.db.execute(stmt)
            return {row.orgnr: row for row in result.scalars().all()}
        except Exception as e:
            logger.error(f"Database error batch-fetching latest financials: {e}")
            raise DatabaseException("Failed to batch-fetch latest financials", original_error=e)

    async def get_sparkline_data_batch(self, orgnrs: list[str], years: int = 5) -> dict[str, list[dict]]:
        """Batch-fetch last N years of key financials for multiple orgnrs.

        Uses the existing idx_regnskap_orgnr_aar covering index for efficient
        time-series retrieval.

        Args:
            orgnrs: List of organization numbers
            years: Number of recent years to include (default 5)

        Returns:
            Dict mapping orgnr → list of {aar, salgsinntekter, aarsresultat} dicts,
            ordered by year ascending.
        """
        if not orgnrs:
            return {}
        try:
            stmt = (
                select(
                    models.Accounting.orgnr,
                    models.Accounting.aar,
                    models.Accounting.salgsinntekter,
                    models.Accounting.aarsresultat,
                )
                .where(models.Accounting.orgnr.in_(orgnrs))
                .order_by(models.Accounting.orgnr, models.Accounting.aar.desc())
            )
            result = await self.db.execute(stmt)
            rows = result.all()

            # Group by orgnr and keep only the last N years per company
            data: dict[str, list[dict]] = {}
            for row in rows:
                orgnr_list = data.setdefault(row.orgnr, [])
                if len(orgnr_list) < years:
                    orgnr_list.append(
                        {
                            "aar": row.aar,
                            "salgsinntekter": row.salgsinntekter,
                            "aarsresultat": row.aarsresultat,
                        }
                    )

            # Reverse to ascending order for sparkline rendering
            for orgnr_list in data.values():
                orgnr_list.reverse()

            return data
        except Exception as e:
            logger.error(f"Database error batch-fetching sparkline data: {e}")
            raise DatabaseException("Failed to batch-fetch sparkline data", original_error=e)

    async def get_by_orgnr_and_year(self, orgnr: str, year: int) -> models.Accounting:
        """Get accounting record for specific year.

        For companies with multiple records in a year, prefers records with
        complete fiscal-period metadata before falling back to latest
        ``periode_til``. This avoids selecting legacy Dec 31 fallback rows
        over real non-calendar fiscal years.

        Args:
            orgnr: Organization number
            year: Accounting year

        Returns:
            Accounting model

        Raises:
            AccountingNotFoundException: If accounting data not found
            DatabaseException: If database error occurs
        """
        try:
            result = await self.db.execute(
                select(models.Accounting)
                .filter(models.Accounting.orgnr == orgnr, models.Accounting.aar == year)
                .order_by(
                    case((models.Accounting.periode_fra.is_not(None), 0), else_=1),
                    models.Accounting.periode_til.desc().nullslast(),
                    models.Accounting.id.desc(),
                )
                .limit(1)
            )
            accounting = result.scalar_one_or_none()

            if not accounting:
                raise AccountingNotFoundException(orgnr, year)

            return accounting
        except AccountingNotFoundException:
            raise
        except ValidationException:
            raise
        except Exception as e:
            logger.error(f"Database error fetching accounting for {orgnr} year {year}: {e}")
            raise DatabaseException(f"Failed to fetch accounting for {orgnr} year {year}", original_error=e)

    async def get_by_id(self, accounting_id: int, orgnr: str) -> models.Accounting | None:
        """Get accounting record by primary key, scoped to a specific company.

        Args:
            accounting_id: Primary key of the accounting record
            orgnr: Organization number — ensures record belongs to this company

        Returns:
            Accounting model or None if not found (or wrong orgnr)

        Raises:
            DatabaseException: If database error occurs
        """
        try:
            result = await self.db.execute(
                select(models.Accounting).filter(
                    models.Accounting.id == accounting_id,
                    models.Accounting.orgnr == orgnr,
                )
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Database error fetching accounting id {accounting_id}: {e}")
            raise DatabaseException(f"Failed to fetch accounting id {accounting_id}", original_error=e)

    async def create_or_update(
        self,
        orgnr: str,
        parsed_data: dict[str, Any],
        raw_data: dict[str, Any],
        autocommit: bool = False,
    ) -> models.Accounting:
        """Create or update accounting record from parsed financial data.

        Uses PostgreSQL's INSERT...ON CONFLICT DO UPDATE for atomic upsert.
        This is race-safe and more efficient than SELECT-then-UPDATE.

        Args:
            orgnr: Organization number
            parsed_data: Parsed financial data with Norwegian field names
            raw_data: Raw JSON from Brønnøysund API
            autocommit: Whether to commit transaction immediately (default False)

        Returns:
            Created or updated Accounting model

        Raises:
            ValidationException: If year is missing from parsed_data
            DatabaseException: If database operation fails
        """
        year = parsed_data.get("aar")
        if not year:
            raise ValidationException("Financial data must include accounting year (aar)")

        # Parse periode dates upfront - needed for unique constraint
        periode_fra = self._parse_date(parsed_data.get("periode_fra"))
        periode_til = self._parse_date(parsed_data.get("periode_til"))

        if periode_til is None:
            raise ValidationException("Financial data must include fiscal period end date (periode_til)")

        try:
            existing_result = await self.db.execute(
                select(models.Accounting).where(
                    models.Accounting.orgnr == orgnr,
                    models.Accounting.periode_til == periode_til,
                )
            )
            existing = existing_result.scalar_one_or_none()
            if existing is not None:
                new_source_id, new_journalnr = self._source_identity(raw_data)
                existing_source_id, existing_journalnr = self._source_identity(existing.raw_data)
                source_id_matches = new_source_id is not None and new_source_id == existing_source_id
                journalnr_matches = new_journalnr is not None and new_journalnr == existing_journalnr
                source_id_conflicts = (
                    new_source_id is not None and existing_source_id is not None and new_source_id != existing_source_id
                )
                journalnr_conflicts = (
                    new_journalnr is not None and existing_journalnr is not None and new_journalnr != existing_journalnr
                )
                if (source_id_conflicts or journalnr_conflicts) and not (source_id_matches or journalnr_matches):
                    raise ValidationException(
                        "Financial data conflicts with an existing statement for the same fiscal period"
                    )

            # Calculate gjeldsgrad using helper method (DRY)
            egenkapital = self._validate_numeric(parsed_data.get("egenkapital"))
            kortsiktig = self._validate_numeric(parsed_data.get("kortsiktig_gjeld"))
            langsiktig = self._validate_numeric(parsed_data.get("langsiktig_gjeld"))
            gjeldsgrad = self._calculate_gjeldsgrad(egenkapital, kortsiktig, langsiktig)

            # Prepare data for upsert
            # Note: likviditetsgrad1, ebitda_margin, and egenkapitalandel are generated columns
            # computed by the database, so they are NOT included in the insert data
            insert_data = {
                "orgnr": orgnr,
                "aar": int(year),
                "periode_fra": periode_fra,
                "periode_til": periode_til,
                "total_inntekt": self._validate_numeric(parsed_data.get("total_inntekt")),
                "aarsresultat": self._validate_numeric(parsed_data.get("aarsresultat")),
                "driftsresultat": self._validate_numeric(parsed_data.get("driftsresultat")),
                "salgsinntekter": self._validate_numeric(parsed_data.get("salgsinntekter")),
                "egenkapital": egenkapital,
                "omloepsmidler": self._validate_numeric(parsed_data.get("omloepsmidler")),
                "kortsiktig_gjeld": kortsiktig,
                "avskrivninger": self._validate_numeric(parsed_data.get("avskrivninger")),
                "anleggsmidler": self._validate_numeric(parsed_data.get("anleggsmidler")),
                "langsiktig_gjeld": langsiktig,
                "gjeldsgrad": gjeldsgrad,
                "raw_data": raw_data,
            }

            # Use PostgreSQL's INSERT...ON CONFLICT for atomic upsert
            insert_stmt = insert(models.Accounting).values(**insert_data)

            # On conflict (duplicate orgnr, periode_til), update all non-generated fields
            # Generated columns (likviditetsgrad1, ebitda_margin, egenkapitalandel) are excluded
            upsert_stmt = insert_stmt.on_conflict_do_update(
                constraint="regnskap_orgnr_periode_unique",
                set_={
                    "aar": insert_stmt.excluded.aar,
                    "periode_fra": insert_stmt.excluded.periode_fra,
                    "total_inntekt": insert_stmt.excluded.total_inntekt,
                    "aarsresultat": insert_stmt.excluded.aarsresultat,
                    "driftsresultat": insert_stmt.excluded.driftsresultat,
                    "salgsinntekter": insert_stmt.excluded.salgsinntekter,
                    "egenkapital": insert_stmt.excluded.egenkapital,
                    "omloepsmidler": insert_stmt.excluded.omloepsmidler,
                    "kortsiktig_gjeld": insert_stmt.excluded.kortsiktig_gjeld,
                    "avskrivninger": insert_stmt.excluded.avskrivninger,
                    "anleggsmidler": insert_stmt.excluded.anleggsmidler,
                    "langsiktig_gjeld": insert_stmt.excluded.langsiktig_gjeld,
                    "gjeldsgrad": insert_stmt.excluded.gjeldsgrad,
                    "raw_data": insert_stmt.excluded.raw_data,
                },
            ).returning(models.Accounting)

            # Execute UPSERT and return full object
            result = await self.db.execute(upsert_stmt)
            accounting = result.scalar_one()

            if autocommit:
                await self.db.commit()

            return accounting

        except AccountingNotFoundException:
            raise
        except ValidationException:
            raise
        except Exception as e:
            if autocommit:
                await self.db.rollback()
            logger.error(f"Database error creating/updating accounting for {orgnr} year {year}: {e}")
            raise DatabaseException(f"Failed to create/update accounting for {orgnr} year {year}", original_error=e)

    async def count(self) -> int:
        result = await self.db.execute(
            text("SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname='regnskap'")
        )
        count = result.scalar()
        return int(count) if count else 0

    async def get_aggregated_stats(self) -> dict[str, float]:
        """Get aggregated financial statistics for the overview dashboard.

        PERFORMANCE OPTIMIZATION:
        Uses the consolidated 'company_totals' materialized view for O(1) performance.
        Calculates only once during view refresh.
        """
        try:
            stmt = text("""
                SELECT
                    total_revenue,
                    total_ebitda,
                    profitable_percentage,
                    solid_company_percentage,
                    avg_operating_margin
                FROM company_totals
                WHERE id = 1
            """)
            result = await self.db.execute(stmt)
            row = result.fetchone()

            if row:
                return {
                    "total_revenue": float(row.total_revenue) if row.total_revenue else 0.0,
                    "total_ebitda": float(row.total_ebitda) if row.total_ebitda else 0.0,
                    "profitable_percentage": float(row.profitable_percentage) if row.profitable_percentage else 0.0,
                    "solid_company_percentage": float(row.solid_company_percentage)
                    if row.solid_company_percentage
                    else 0.0,
                    "avg_operating_margin": float(row.avg_operating_margin) if row.avg_operating_margin else 0.0,
                }
            # company_totals not yet populated — return zeros rather than raising
            return {
                "total_revenue": 0.0,
                "total_ebitda": 0.0,
                "profitable_percentage": 0.0,
                "solid_company_percentage": 0.0,
                "avg_operating_margin": 0.0,
            }
        except Exception as e:
            logger.error("stats.fallback path=accounting_totals error=%s", e, exc_info=True)
            raise DatabaseException("Failed to get accounting aggregate stats", original_error=e)

    # All materialized view refreshes are owned by SchedulerService.refresh_views_light/heavy.
    # Do NOT add REFRESH MATERIALIZED VIEW calls here.
