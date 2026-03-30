"""
Shared mapping utilities for Brønnøysund API data transformations.

This module eliminates duplication of field mapping logic across services
(company_service.py, update_service.py, repair_service.py).
"""

import logging
from datetime import date, datetime
from typing import Any

import models

logger = logging.getLogger(__name__)


def parse_brreg_date(date_str: Any) -> date | None:
    """
    Safely parse a date string from Brønnøysund API into a Python date object.

    Handles formats:
    - YYYY-MM-DD
    - ISO datetime (extracts date portion)

    Args:
        date_str: Date string from API (e.g., "2023-01-15" or "2023-01-15T00:00:00")

    Returns:
        Python date object or None if parsing fails
    """
    if not date_str or not isinstance(date_str, str):
        return None
    try:
        # Handle YYYY-MM-DD or ISO with time (extract first 10 chars)
        return datetime.strptime(date_str[:10], "%Y-%m-%d").date()
    except ValueError, TypeError, IndexError:
        logger.debug(f"Failed to parse date string: {date_str}")
        return None


def map_subunit_from_api(data: dict[str, Any], parent_orgnr: str) -> models.SubUnit:
    """
    Map Brønnøysund Enhetsregisteret API subunit data to SubUnit model.

    API response field names differ from model attributes:
    - API: organisasjonsnummer → Model: orgnr
    - API: naeringskode1.kode → Model: naeringskode
    - API: organisasjonsform.kode → Model: organisasjonsform
    - API: antallAnsatte → Model: antall_ansatte
    - API: registreringsdatoEnhetsregisteret → Model: registreringsdato_enhetsregisteret

    Args:
        data: Raw JSON dict from Brønnøysund API /underenheter endpoint
        parent_orgnr: Organization number of the parent company

    Returns:
        SubUnit model instance ready for database insertion
    """
    return models.SubUnit(
        orgnr=data.get("organisasjonsnummer"),
        navn=data.get("navn"),
        parent_orgnr=parent_orgnr,
        organisasjonsform=(data.get("organisasjonsform", {}).get("kode") if data.get("organisasjonsform") else None),
        naeringskode=(data.get("naeringskode1", {}).get("kode") if data.get("naeringskode1") else None),
        antall_ansatte=data.get("antallAnsatte", 0),
        beliggenhetsadresse=data.get("beliggenhetsadresse"),
        postadresse=data.get("postadresse"),
        stiftelsesdato=parse_brreg_date(data.get("stiftelsesdato")),
        registreringsdato_enhetsregisteret=parse_brreg_date(data.get("registreringsdatoEnhetsregisteret")),
        raw_data=data,
    )


def map_role_from_api(data: dict[str, Any], orgnr: str) -> models.Role:
    """
    Map Brønnøysund Enhetsregisteret API role data to Role model.

    Used by role sync operations across multiple services:
    - update_service.py (role streaming sync)
    - repair_service.py (role backfill)
    - scheduler.py (error retry)
    - role_service.py (on-demand fetch)

    Args:
        data: Raw JSON dict from Brønnøysund API /roller endpoint
        orgnr: Organization number the role belongs to

    Returns:
        Role model instance ready for database insertion
    """
    return models.Role(
        orgnr=orgnr,
        type_kode=data.get("type_kode"),
        type_beskrivelse=data.get("type_beskrivelse"),
        person_navn=data.get("person_navn"),
        foedselsdato=parse_brreg_date(data.get("foedselsdato")),
        enhet_navn=data.get("enhet_navn"),
        enhet_orgnr=data.get("enhet_orgnr"),
        fratraadt=data.get("fratraadt", False),
        rekkefoelge=data.get("rekkefoelge"),
    )
