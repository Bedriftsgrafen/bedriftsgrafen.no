import logging
from datetime import date, datetime
from typing import Any

from sqlalchemy import select, text
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
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _validate_numeric(val: Any) -> float | None:
        """Convert to float and validate, return None if invalid (NaN/Infinity)."""
        if val is None:
            return None
        try:
            num = float(val)
            # Reject NaN and Infinity
            if num != num or num in (float("inf"), float("-inf")):
                return None
            return num
        except (ValueError, TypeError, OverflowError):
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
            if ratio != ratio or ratio in (float("inf"), float("-inf")):
                return None
            return ratio
        except (ZeroDivisionError, OverflowError):
            return None

    async def get_by_orgnr(self, orgnr: str) -> list[models.Accounting]:
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

    async def get_by_orgnr_and_year(self, orgnr: str, year: int) -> models.Accounting:
        """Get accounting record for specific year.

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
                select(models.Accounting).filter(models.Accounting.orgnr == orgnr, models.Accounting.aar == year)
            )
            accounting = result.scalar_one_or_none()

            if not accounting:
                raise AccountingNotFoundException(orgnr, year)

            return accounting
        except AccountingNotFoundException:
            raise
        except Exception as e:
            logger.error(f"Database error fetching accounting for {orgnr} year {year}: {e}")
            raise DatabaseException(f"Failed to fetch accounting for {orgnr} year {year}", original_error=e)

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

        # Fallback: if periode_til is missing, use Dec 31 of the year
        # This ensures unique constraint (orgnr, periode_til) can work
        if periode_til is None:
            periode_til = date(int(year), 12, 31)

        try:
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
            stmt = insert(models.Accounting).values(**insert_data)

            # On conflict (duplicate orgnr, periode_til), update all non-generated fields
            # Generated columns (likviditetsgrad1, ebitda_margin, egenkapitalandel) are excluded
            stmt = stmt.on_conflict_do_update(
                constraint="regnskap_orgnr_periode_unique",
                set_={
                    "aar": stmt.excluded.aar,
                    "periode_fra": stmt.excluded.periode_fra,
                    "total_inntekt": stmt.excluded.total_inntekt,
                    "aarsresultat": stmt.excluded.aarsresultat,
                    "driftsresultat": stmt.excluded.driftsresultat,
                    "salgsinntekter": stmt.excluded.salgsinntekter,
                    "egenkapital": stmt.excluded.egenkapital,
                    "omloepsmidler": stmt.excluded.omloepsmidler,
                    "kortsiktig_gjeld": stmt.excluded.kortsiktig_gjeld,
                    "avskrivninger": stmt.excluded.avskrivninger,
                    "anleggsmidler": stmt.excluded.anleggsmidler,
                    "langsiktig_gjeld": stmt.excluded.langsiktig_gjeld,
                    "gjeldsgrad": stmt.excluded.gjeldsgrad,
                    "raw_data": stmt.excluded.raw_data,
                },
            ).returning(models.Accounting)

            # Execute UPSERT and return full object
            result = await self.db.execute(stmt)
            accounting = result.scalar_one()

            if autocommit:
                await self.db.commit()

            return accounting

        except AccountingNotFoundException:
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
        """
        Calculate all financial statistics using the materialized view
        for instant performance.
        """
        stmt = text("""
            SELECT
                SUM(salgsinntekter) as total_revenue,
                COUNT(CASE WHEN aarsresultat > 0 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as profitable_percentage,
                AVG(
                    CASE WHEN total_inntekt > 0
                    THEN (driftsresultat::float / total_inntekt) * 100
                    ELSE NULL END
                ) as avg_operating_margin
            FROM latest_accountings
        """)

        try:
            result = await self.db.execute(stmt)
            row = result.one()

            return {
                "total_revenue": float(row.total_revenue) if row.total_revenue else 0.0,
                "profitable_percentage": float(row.profitable_percentage) if row.profitable_percentage else 0.0,
                "avg_operating_margin": float(row.avg_operating_margin) if row.avg_operating_margin else 0.0,
            }
        except Exception:
            # Fallback if view doesn't exist yet
            return {"total_revenue": 0.0, "profitable_percentage": 0.0, "avg_operating_margin": 0.0}

    async def refresh_materialized_view(self):
        """Refresh the materialized view concurrently"""
        await self.db.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY latest_accountings"))
        await self.db.commit()
