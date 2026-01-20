import asyncio
import os
import sys
from datetime import date, datetime, timedelta

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from database import AsyncSessionLocal
from repositories.system_repository import SystemRepository
from sqlalchemy import select, text
from models import Company, SyncError

async def investigate():
    async with AsyncSessionLocal() as db:
        print("--- System State ---")
        repo = SystemRepository(db)
        latest_id = await repo.get_state("company_update_latest_id")
        last_sync = await repo.get_state("company_update_last_sync_date")
        print(f"company_update_latest_id: {latest_id}")
        print(f"company_update_last_sync_date: {last_sync}")

        print("\n--- Recent Companies (Since 2026-01-16) ---")
        # Check by registered date (stiftelsesdato) or created_at?
        # Brreg "nyetableringer" usually refers to 'registrert_i_enhetsregisteret' or 'stiftelsesdato'.
        # Let's check both if possible, but model fields might differ.
        # Looking at UpdateService, it saves company data.
        
        # Let's check stiftelsesdato >= 2026-01-16
        stmt = select(Company).where(Company.stiftelsesdato >= date(2026, 1, 16)).limit(20)
        result = await db.execute(stmt)
        companies = result.scalars().all()
        
        print(f"Found {len(companies)} companies with stiftelsesdato >= 2026-01-16 (showing max 20):")
        for c in companies:
            print(f"- {c.orgnr}: {c.navn} (Stiftet: {c.stiftelsesdato})")

        print("\n--- Specific Check (Unrestricted) ---")
        stmt = select(Company).where(Company.navn.ilike("%TXP HOLDINGS%"))
        result = await db.execute(stmt)
        specific = result.scalars().all()
        if not specific:
            print("NOT FOUND: TXP HOLDINGS AS")
        for c in specific:
             print(f"Found: {c.orgnr} {c.navn} {c.stiftelsesdato})")



        print("\n--- Sync Errors ---")
        stmt = select(SyncError).order_by(SyncError.created_at.desc()).limit(10)
        result = await db.execute(stmt)
        errors = result.scalars().all()
        if not errors:
            print("No recent sync errors.")
        else:
            for e in errors:
                print(f"- {e.entity_type} {e.orgnr}: {e.error_message} ({e.status})")

if __name__ == "__main__":
    asyncio.run(investigate())
