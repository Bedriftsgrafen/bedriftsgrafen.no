import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from services.company_service import CompanyService
from services.dtos import CompanyFilterDTO

logger = logging.getLogger(__name__)


class ExportService:
    """Service for exporting company data."""

    # Maximum rows for CSV export (performance limit for efficient hardware)
    EXPORT_ROW_LIMIT: int = 1000

    def __init__(self, db: AsyncSession):
        self.db = db
        self.company_service = CompanyService(db)

    async def stream_companies_csv(self, filters: CompanyFilterDTO) -> AsyncGenerator[bytes, None]:
        """
        Stream companies as CSV rows.
        Generates UTF-8 encoded bytes with BOM.
        """
        try:
            yield "\ufeff".encode()  # UTF-8 BOM

            # CSV Header
            yield "Org.nr;Navn;Organisasjonsform;Næringskode;Kommune;Ansatte;Omsetning;Resultat;Stiftelsesdato\n".encode()

            # Helper to format CSV value
            def fmt(val):
                if val is None:
                    return ""
                return str(val).replace(";", ",")  # Escaping

            # Force limit to avoid memory exhaustion (redundant safety)
            if not filters.limit or filters.limit > self.EXPORT_ROW_LIMIT:
                filters.limit = self.EXPORT_ROW_LIMIT

            async for company in self.company_service.stream_companies(filters):
                kommune = ""
                if company.forretningsadresse:
                    kommune = company.forretningsadresse.get("kommune", "")
                elif company.postadresse:
                    kommune = company.postadresse.get("kommune", "")

                # Format line manually to avoid csv module overhead/blocking in async generator
                line = (
                    f"{fmt(company.orgnr)};"
                    f"{fmt(company.navn)};"
                    f"{fmt(company.organisasjonsform)};"
                    f"{fmt(company.naeringskode)};"
                    f"{fmt(kommune)};"
                    f"{fmt(company.antall_ansatte)};"
                    f"{fmt(company.latest_revenue)};"
                    f"{fmt(company.latest_profit)};"
                    f"{fmt(company.stiftelsesdato.isoformat() if company.stiftelsesdato else '')}\n"
                )
                yield line.encode("utf-8")

        except Exception as e:
            logger.error(f"Export streaming failed: {e}", exc_info=True)
            raise
