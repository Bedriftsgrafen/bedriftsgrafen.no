"""Base classes, constants, and shared imports for company repository.

This module contains shared code used across all company repository modules.
"""

import asyncio
import logging

from sqlalchemy.orm import defer, noload, selectinload

import models

logger = logging.getLogger(__name__)

# Query timeout for aggregate stats (Resource protection)
STATS_QUERY_TIMEOUT_SECONDS = 10.0

# Limit concurrent full-text search queries to avoid exhausting DB connections
SEARCH_SEMAPHORE = asyncio.Semaphore(8)
SEARCH_SEMAPHORE_TIMEOUT = 5.0

# Reusable query optimization options
LIST_VIEW_OPTIONS = [
    defer(models.Company.search_vector),
    defer(models.Company.raw_data),
    noload(models.Company.regnskap),
]

DETAIL_VIEW_OPTIONS = [selectinload(models.Company.regnskap), defer(models.Company.search_vector)]

# Mapping of sort keys to SQLAlchemy columns (shared between queries.py methods)
SORT_COLUMN_MAP = {
    "navn": models.Company.navn,
    "orgnr": models.Company.orgnr,
    "organisasjonsform": models.Company.organisasjonsform,
    "antall_ansatte": models.Company.antall_ansatte,
    "stiftelsesdato": models.Company.stiftelsesdato,
    "registreringsdato_enhetsregisteret": models.Company.registreringsdato_enhetsregisteret,
    "konkursdato": models.Company.konkursdato,
    "naeringskode": models.Company.naeringskode,
    "kommune": models.Company.forretningsadresse["kommune"].astext,
    "operating_margin": models.LatestFinancials.operating_margin,
}

# Raw SQL column names for optimized queries
SORT_COLUMN_SQL_MAP = {
    "navn": "navn",
    "orgnr": "orgnr",
    "organisasjonsform": "organisasjonsform",
    "antall_ansatte": "antall_ansatte",
    "stiftelsesdato": "stiftelsesdato",
    "registreringsdato_enhetsregisteret": "registreringsdato_enhetsregisteret",
    "konkursdato": "konkursdato",
    "naeringskode": "naeringskode",
    "kommune": "forretningsadresse->>'kommune'",
    "operating_margin": "operating_margin",
    "revenue": "salgsinntekter",
    "profit": "aarsresultat",
}

# Shared columns from LatestFinancials for consistency
LATEST_FINANCIAL_COLUMNS = [
    models.LatestFinancials.salgsinntekter.label("latest_revenue"),
    models.LatestFinancials.aarsresultat.label("latest_profit"),
    models.LatestFinancials.driftsresultat.label("latest_operating_profit"),
    models.LatestFinancials.operating_margin.label("latest_operating_margin"),
    models.LatestFinancials.egenkapitalandel.label("latest_equity_ratio"),
]


class CompanyWithFinancials:
    """Simple wrapper to hold company + financial data together."""

    def __init__(
        self,
        company: models.Company,
        latest_revenue: float | None = None,
        latest_profit: float | None = None,
        latest_operating_profit: float | None = None,
        latest_operating_margin: float | None = None,
        latest_equity_ratio: float | None = None,
    ):
        # Copy company attributes needed for list view
        self.orgnr = company.orgnr
        self.navn = company.navn
        self.organisasjonsform = company.organisasjonsform
        self.naeringskode = company.naeringskode
        self.antall_ansatte = company.antall_ansatte
        self.stiftelsesdato = company.stiftelsesdato
        self.registreringsdato_enhetsregisteret = company.registreringsdato_enhetsregisteret
        self.registreringsdato_foretaksregisteret = company.registreringsdato_foretaksregisteret
        self.registrert_i_foretaksregisteret = company.registrert_i_foretaksregisteret
        self.registrert_i_mvaregisteret = company.registrert_i_mvaregisteret
        self.registrert_i_frivillighetsregisteret = company.registrert_i_frivillighetsregisteret
        self.registrert_i_stiftelsesregisteret = company.registrert_i_stiftelsesregisteret
        self.registrert_i_partiregisteret = company.registrert_i_partiregisteret
        self.konkurs = company.konkurs
        self.under_avvikling = company.under_avvikling
        self.under_tvangsavvikling = company.under_tvangsavvikling
        self.konkursdato = company.konkursdato
        self.vedtektsfestet_formaal = company.vedtektsfestet_formaal
        self.hjemmeside = company.hjemmeside
        self.postadresse = company.postadresse
        self.forretningsadresse = company.forretningsadresse
        self.data = None
        self.naeringskoder: list[str] = []
        self.latest_revenue = latest_revenue
        self.latest_profit = latest_profit
        self.latest_operating_profit = latest_operating_profit
        self.latest_equity_ratio = latest_equity_ratio

        # Use provided margin or calculate as percentage
        if latest_operating_margin is not None:
            self.latest_operating_margin: float | None = latest_operating_margin
        else:
            self.latest_operating_margin = (
                (latest_operating_profit / latest_revenue * 100)
                if latest_revenue and latest_revenue > 0 and latest_operating_profit is not None
                else None
            )
