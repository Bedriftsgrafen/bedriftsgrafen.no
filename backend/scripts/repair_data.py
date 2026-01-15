import asyncio
import logging
import argparse
from database import AsyncSessionLocal
from services.repair_service import RepairService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("repair_data_cli")

async def main():
    parser = argparse.ArgumentParser(description="Bedriftsgrafen Data Repair CLI")
    parser.add_argument("--mode", choices=["ghosts", "subunits", "roles", "all"], default="all", help="Repair mode")
    parser.add_argument("--limit", type=int, default=50, help="Number of records to process per phase")
    parser.add_argument("--repair", action="store_true", help="Actually apply fixes (default is dry-run)")
    
    args = parser.parse_args()
    
    async with AsyncSessionLocal() as db:
        service = RepairService(db, repair=args.repair)
        
        if args.mode in ["ghosts", "all"]:
            await service.fix_ghost_parents(limit=args.limit)
            
        if args.mode in ["subunits", "all"]:
            await service.audit_subunits(limit=args.limit)
            
        if args.mode in ["roles", "all"]:
            await service.backfill_roles(limit=args.limit)

if __name__ == "__main__":
    asyncio.run(main())
