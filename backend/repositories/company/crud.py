"""CRUD operations for companies.

Contains create_or_update and related data manipulation methods.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

import models
from exceptions import DatabaseException

logger = logging.getLogger(__name__)


class CrudMixin:
    """Mixin providing CRUD operations for CompanyRepository."""

    db: AsyncSession  # Type hint for mixin

    def _parse_company_fields(self, company_data: dict[str, Any]) -> dict[str, Any]:
        """Parse and normalize company data from Brønnøysund API.

        Reduces code duplication between create and update paths.
        Handles invalid dates and missing fields gracefully.
        """
        stiftelsesdato_str = company_data.get("stiftelsesdato")
        stiftelsesdato = None
        if stiftelsesdato_str:
            try:
                stiftelsesdato = datetime.fromisoformat(stiftelsesdato_str).date()
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse stiftelsesdato '{stiftelsesdato_str}': {e}")
                stiftelsesdato = None

        # Get organisasjonsform safely
        org_form_obj = company_data.get("organisasjonsform")
        organisasjonsform = None
        if org_form_obj and isinstance(org_form_obj, dict):
            organisasjonsform = org_form_obj.get("kode")
        if organisasjonsform == "":
            organisasjonsform = None

        # Parse konkursdato
        konkursdato_str = company_data.get("konkursdato")
        konkursdato = None
        if konkursdato_str:
            try:
                konkursdato = datetime.fromisoformat(konkursdato_str).date()
            except (ValueError, TypeError):
                konkursdato = None

        # Parse register flags
        mva_raw = company_data.get("registrertIMvaregisteret")
        registrert_i_mvaregisteret = bool(mva_raw)

        frivillig_raw = company_data.get("registrertIFrivillighetsregisteret")
        registrert_i_frivillighetsregisteret = bool(frivillig_raw)

        stiftelse_raw = company_data.get("registrertIStiftelsesregisteret")
        registrert_i_stiftelsesregisteret = bool(stiftelse_raw)

        parti_raw = company_data.get("registrertIPartiregisteret")
        registrert_i_partiregisteret = bool(parti_raw)

        # Parse vedtektsfestetFormaal
        formaal_raw = company_data.get("vedtektsfestetFormaal")
        vedtektsfestet_formaal = None
        if formaal_raw:
            if isinstance(formaal_raw, list):
                vedtektsfestet_formaal = "\n".join(str(x) for x in formaal_raw)
            elif isinstance(formaal_raw, str):
                vedtektsfestet_formaal = formaal_raw

        # Parse registrertIForetaksregisteret
        # Brreg returns metadata.registrertIForetaksregisteret as 'Ja'/'Nei' or just as a bool depending on version
        foretaksreg_raw = company_data.get("registrertIForetaksregisteret")
        if isinstance(foretaksreg_raw, str):
            registrert_i_foretaksregisteret = foretaksreg_raw.lower() in ("ja", "true")
        registrert_i_foretaksregisteret = bool(foretaksreg_raw)

        # Parse registration dates
        reg_enhet_str = company_data.get("registreringsdatoEnhetsregisteret")
        reg_enhet = None
        if reg_enhet_str:
            try:
                reg_enhet = datetime.fromisoformat(reg_enhet_str).date()
            except (ValueError, TypeError):
                reg_enhet = None

        reg_foretak_str = company_data.get("registreringsdatoForetaksregisteret")
        reg_foretak = None
        if reg_foretak_str:
            try:
                reg_foretak = datetime.fromisoformat(reg_foretak_str).date()
            except (ValueError, TypeError):
                reg_foretak = None

        return {
            "navn": company_data.get("navn"),
            "organisasjonsform": organisasjonsform,
            "naeringskode": company_data.get("naeringskode1", {}).get("kode"),
            "antall_ansatte": company_data.get("antallAnsatte"),
            "stiftelsesdato": stiftelsesdato,
            "konkurs": company_data.get("konkurs", False),
            "konkursdato": konkursdato,
            "under_avvikling": company_data.get("underAvvikling", False),
            "under_tvangsavvikling": company_data.get("underTvangsavvikling", False),
            "vedtektsfestet_formaal": vedtektsfestet_formaal,
            "hjemmeside": company_data.get("hjemmeside"),
            "registrert_i_foretaksregisteret": registrert_i_foretaksregisteret,
            "registrert_i_mvaregisteret": registrert_i_mvaregisteret,
            "registrert_i_frivillighetsregisteret": registrert_i_frivillighetsregisteret,
            "registrert_i_stiftelsesregisteret": registrert_i_stiftelsesregisteret,
            "registrert_i_partiregisteret": registrert_i_partiregisteret,
            "registreringsdato_enhetsregisteret": reg_enhet,
            "registreringsdato_foretaksregisteret": reg_foretak,
            "data": company_data,
            "postadresse": company_data.get("postadresse"),
            "forretningsadresse": company_data.get("forretningsadresse"),
        }

    async def create_or_update(self, company_data: dict[str, Any], autocommit: bool = False) -> models.Company:
        """Create or update company from Brønnøysund API data.

        Uses PostgreSQL's INSERT...ON CONFLICT DO UPDATE for atomic upsert.
        This is race-safe and more efficient than SELECT-then-UPDATE.

        Args:
            company_data: Raw company data from Brønnøysund API
            autocommit: Whether to commit transaction immediately (default False)

        Returns:
            Created or updated Company model

        Raises:
            DatabaseException: If database operation fails
        """
        orgnr = company_data.get("organisasjonsnummer")

        try:
            # Parse all fields
            fields = self._parse_company_fields(company_data)
            fields["orgnr"] = orgnr  # Ensure PK is in fields

            # Prepare UPSERT statement
            from sqlalchemy.dialects.postgresql import insert

            stmt: Any = insert(models.Company).values(**fields)

            # On conflict (PK orgnr), update all fields except PK and creation metadata
            update_dict = {k: getattr(stmt.excluded, k) for k in fields.keys() if k not in ["orgnr", "created_at"]}

            stmt = stmt.on_conflict_do_update(
                index_elements=["orgnr"],
                set_=update_dict,
            ).returning(models.Company)

            # Execute UPSERT
            result = await self.db.execute(stmt)
            company = result.scalar_one()

            if autocommit:
                await self.db.commit()

            return company

        except Exception as e:
            if autocommit:
                await self.db.rollback()
            logger.error(f"Database error creating/updating company {orgnr}: {e}")
            raise DatabaseException(f"Failed to create/update company {orgnr}", original_error=e)

    async def update_coordinates(self, orgnr: str, lat: float, lon: float) -> None:
        """Update company coordinates and timestamp."""
        try:
            stmt = (
                update(models.Company)
                .where(models.Company.orgnr == orgnr)
                .values(latitude=lat, longitude=lon, geocoded_at=datetime.now(timezone.utc).replace(tzinfo=None))
            )
            await self.db.execute(stmt)
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to update coordinates for {orgnr}: {e}")
            raise DatabaseException(f"Failed to update coordinates for {orgnr}", original_error=e)

    async def update_last_polled_regnskap(self, orgnr: str) -> None:
        """Update the last_polled_regnskap timestamp for a company."""
        # Note: No internal commit here, relies on caller to commit
        stmt = (
            update(models.Company)
            .where(models.Company.orgnr == orgnr)
            .values(last_polled_regnskap=datetime.now(timezone.utc).date())
        )
        await self.db.execute(stmt)

    async def update_last_polled_roles(self, orgnr: str) -> None:
        """Update the last_polled_roles timestamp for a company."""
        # Note: No internal commit here, relies on caller to commit
        stmt = (
            update(models.Company)
            .where(models.Company.orgnr == orgnr)
            .values(last_polled_roles=datetime.now(timezone.utc).date())
        )
        await self.db.execute(stmt)
