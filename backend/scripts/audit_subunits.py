import asyncio
import logging
from sqlalchemy import select, func
from database import AsyncSessionLocal
import models
from services.brreg_api_service import BrregApiService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audit_subunits")


async def audit_subunits(limit: int = 100):
    """
    Audits subunit counts for the top N companies (by employee count).
    Compares local DB count with Brreg API count.
    """
    brreg_api = BrregApiService()

    async with AsyncSessionLocal() as db:
        # 1. Get top companies
        stmt = select(models.Company).order_by(models.Company.antall_ansatte.desc().nullslast()).limit(limit)
        result = await db.execute(stmt)
        companies = result.scalars().all()

        logger.info(f"Auditing subunits for {len(companies)} top companies...")

        total_missing = 0
        total_audited = 0

        for company in companies:
            try:
                # Get local count
                local_count_stmt = select(func.count(models.SubUnit.orgnr)).where(
                    models.SubUnit.parent_orgnr == company.orgnr
                )
                local_count_res = await db.execute(local_count_stmt)
                local_count = local_count_res.scalar() or 0

                # Get API subunits
                api_subunits = await brreg_api.fetch_subunits(company.orgnr)
                api_count = len(api_subunits)

                if local_count < api_count:
                    diff = api_count - local_count
                    logger.warning(
                        f"Company {company.orgnr} ({company.navn}): Local={local_count}, API={api_count}. MISSING {diff}"
                    )
                    total_missing += diff

                total_audited += 1
                if total_audited % 10 == 0:
                    logger.info(f"Audited {total_audited}/{len(companies)} companies...")

            except Exception as e:
                logger.error(f"Failed to audit {company.orgnr}: {e}")

        logger.info(f"Audit complete. Total missing subunits detected: {total_missing}")


if __name__ == "__main__":
    asyncio.run(audit_subunits(limit=50))
