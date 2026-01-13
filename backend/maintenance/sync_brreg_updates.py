import asyncio
import logging
import sys
import os
import argparse

# Ensure we can import from backend root
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.scheduler import SchedulerService

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sync_trigger")


async def main(args):
    s = SchedulerService()

    if args.type in ["all", "subunits"]:
        logger.info("Starting manual subunit sync...")
        await s.run_subunit_updates()

    if args.type in ["all", "roles"]:
        logger.info("Starting manual role sync...")
        await s.run_role_updates()

    logger.info("Sync tasks completed!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manually trigger Brreg synchronization tasks.")
    parser.add_argument(
        "--type", choices=["all", "subunits", "roles"], default="all", help="Type of updates to sync (default: all)"
    )

    args = parser.parse_args()
    asyncio.run(main(args))
