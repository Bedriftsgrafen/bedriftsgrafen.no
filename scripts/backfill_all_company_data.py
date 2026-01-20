
import asyncio
import logging
from database import AsyncSessionLocal
from services.repair_service import RepairService
from services.update_service import UpdateService
from repositories.company.repository import CompanyRepository

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_backfill():
    async with AsyncSessionLocal() as session:
        # We need to construct the dependencies manually or use a simple loop
        # RepairService needs UpdateService which needs CompanyRepository
        company_repo = CompanyRepository(session)
        update_service = UpdateService(session)
        repair_service = RepairService(session, update_service)
        
        # Run in a loop to process all companies (RepairService.backfill_registration_dates has a limit)
        total_backfilled = 0
        limit = 1000
        while True:
            # We'll use the method I wrote earlier
            # I added it to RepairService in step 191
            # Let's verify if I can just call it
            logger.info("Running backfill chunk...")
            
            # Since I want to backfill ALL flags and dates, I'll write a custom loop here 
            # to be sure it covers the NEW flags I added later (MVA, etc.)
            from sqlalchemy import select
            import models.company as models
            
            # Find companies where the new MVA flag is still at default false but might be true in raw_data,
            # or where registration date is missing.
            # To be safe, let's just process companies missing the registration date first.
            stmt = select(models.Company).where(models.Company.registreringsdato_enhetsregisteret.is_(None)).limit(limit)
            result = await session.execute(stmt)
            companies = result.scalars().all()
            
            if not companies:
                logger.info("No more companies missing registration dates.")
                break
                
            count = 0
            for company in companies:
                if not company.raw_data:
                    continue
                
                # Use the existing parser
                fields = company_repo._parse_company_fields(company.raw_data)
                
                # Update all the new fields
                for field in [
                    "registreringsdato_enhetsregisteret", 
                    "registreringsdato_foretaksregisteret",
                    "registrert_i_mvaregisteret",
                    "registrert_i_frivillighetsregisteret",
                    "registrert_i_stiftelsesregisteret",
                    "registrert_i_partiregisteret"
                ]:
                    if field in fields:
                        setattr(company, field, fields[field])
                
                count += 1
            
            await session.commit()
            total_backfilled += count
            logger.info(f"Backfilled {count} companies in this chunk. Total: {total_backfilled}")
            
            if len(companies) < limit:
                break

    logger.info(f"Backfill complete. Total companies updated: {total_backfilled}")

if __name__ == "__main__":
    asyncio.run(run_backfill())
