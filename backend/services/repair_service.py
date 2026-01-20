import asyncio
import logging
from aiolimiter import AsyncLimiter
from sqlalchemy import select, func, text, delete
from sqlalchemy.ext.asyncio import AsyncSession
import models
from services.brreg_api_service import BrregApiService
from services.update_service import UpdateService
from repositories.company.repository import CompanyRepository
from repositories.subunit_repository import SubUnitRepository
from repositories.role_repository import RoleRepository

logger = logging.getLogger(__name__)

# Global Rate Limiter: 5 requests per second to avoid Brreg 429s
repair_limiter = AsyncLimiter(5, 1)
# Bounded Concurrency: Max 10 simultaneous API tasks
repair_semaphore = asyncio.Semaphore(10)


class RepairService:
    """Service to identify and fix data integrity issues proactively."""

    def __init__(self, db: AsyncSession, repair: bool = False) -> None:
        self.db = db
        self.repair = repair
        self.brreg_api = BrregApiService()
        self.update_service = UpdateService(db)
        self.company_repo = CompanyRepository(db)
        self.subunit_repo = SubUnitRepository(db)
        self.role_repo = RoleRepository(db)

    async def run_all_repairs(self, limit: int = 100) -> None:
        """Run all repair phases in sequence."""
        logger.info(f"Starting scheduled data repair session (limit={limit}, repair={self.repair})")
        await self.fix_ghost_parents(limit=limit)
        await self.audit_subunits(limit=limit)
        await self.backfill_roles(limit=limit)
        await self.backfill_registration_dates(limit=limit)
        logger.info("Scheduled data repair session complete.")

    async def backfill_registration_dates(self, limit: int = 100) -> None:
        """Backfill registration dates from raw_data for companies missing them."""
        logger.info(f"Repair: Backfilling registration dates (limit={limit})...")

        stmt = select(models.Company).where(models.Company.registreringsdato_enhetsregisteret.is_(None)).limit(limit)
        result = await self.db.execute(stmt)
        companies = result.scalars().all()

        if not companies:
            return

        success_count = 0
        for company in companies:
            if not company.raw_data:
                continue

            # Parse dates from stored raw_data
            fields = self.update_service.company_repo._parse_company_fields(company.raw_data)

            if fields.get("registreringsdato_enhetsregisteret"):
                company.registreringsdato_enhetsregisteret = fields["registreringsdato_enhetsregisteret"]
                company.registreringsdato_foretaksregisteret = fields.get("registreringsdato_foretaksregisteret")
                success_count += 1

        if self.repair and success_count > 0:
            await self.db.commit()
            logger.info(f"Successfully backfilled {success_count} companies.")

    async def fix_ghost_parents(self, limit: int = 100) -> None:
        """Phase 1: Find subunits referencing non-existent parent companies."""
        logger.info(f"Repair Phase 1: Ghost Parents (limit={limit})...")

        stmt = text("""
            SELECT DISTINCT parent_orgnr
            FROM underenheter u
            WHERE NOT EXISTS (
                SELECT 1 FROM bedrifter b WHERE b.orgnr = u.parent_orgnr
            )
            LIMIT :limit
        """)
        result = await self.db.execute(stmt, {"limit": limit})
        ghost_orgnrs = [row[0] for row in result.fetchall()]

        if not ghost_orgnrs:
            return

        logger.info(f"Found {len(ghost_orgnrs)} ghost parents.")

        if self.repair:
            tasks = [self._repair_company(orgnr) for orgnr in ghost_orgnrs]
            results = await asyncio.gather(*tasks)
            success_count = sum(1 for r in results if r)
            logger.info(f"Ghost Repair: {success_count}/{len(ghost_orgnrs)} fixed.")
            await self.db.commit()

    async def audit_subunits(self, limit: int = 100) -> None:
        """Phase 2: Compare subunit counts and backfill missing ones."""
        logger.info(f"Repair Phase 2: Subunit Audit (limit={limit})...")

        stmt = select(models.Company).order_by(models.Company.antall_ansatte.desc().nullslast()).limit(limit)
        result = await self.db.execute(stmt)
        companies = result.scalars().all()

        for company in companies:
            async with repair_semaphore:
                async with repair_limiter:
                    try:
                        api_subunits = await self.brreg_api.fetch_subunits(company.orgnr)
                        local_count_stmt = select(func.count(models.SubUnit.orgnr)).where(
                            models.SubUnit.parent_orgnr == company.orgnr
                        )
                        local_count_res = await self.db.execute(local_count_stmt)
                        local_count = local_count_res.scalar() or 0

                        if local_count < len(api_subunits):
                            logger.info(f"Fixing subunits for {company.orgnr}: {local_count} -> {len(api_subunits)}")

                            if self.repair:
                                subunit_models = [
                                    models.SubUnit(
                                        orgnr=s.get("organisasjonsnummer"),
                                        parent_orgnr=company.orgnr,
                                        navn=s.get("navn"),
                                        organisasjonsform=s.get("organisasjonsform", {}).get("kode"),
                                        naeringskode=s.get("naeringskode1", {}).get("kode"),
                                        antall_ansatte=s.get("antallAnsatte", 0),
                                        beliggenhetsadresse=s.get("beliggenhetsadresse"),
                                        postadresse=s.get("postadresse"),
                                        stiftelsesdato=self.update_service._parse_date(s.get("stiftelsesdato")),
                                    )
                                    for s in api_subunits
                                ]
                                await self.subunit_repo.create_batch(subunit_models)
                    except Exception as e:
                        logger.error(f"Subunit audit failed for {company.orgnr}: {e}")

        if self.repair:
            await self.db.commit()

    async def backfill_roles(self, limit: int = 100) -> None:
        """Phase 3: Backfill roles for companies that have never been polled."""
        logger.info(f"Repair Phase 3: Role Backfill (limit={limit})...")

        stmt = (
            select(models.Company)
            .where(models.Company.last_polled_roles.is_(None))
            .order_by(models.Company.antall_ansatte.desc().nullslast())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        companies = result.scalars().all()

        for company in companies:
            async with repair_semaphore:
                async with repair_limiter:
                    try:
                        roles_data = await self.brreg_api.fetch_roles(company.orgnr)

                        role_models = [
                            models.Role(
                                orgnr=company.orgnr,
                                type_kode=r.get("type_kode"),
                                type_beskrivelse=r.get("type_beskrivelse"),
                                person_navn=r.get("person_navn"),
                                foedselsdato=self.update_service._parse_date(r.get("foedselsdato")),
                                enhet_navn=r.get("enhet_navn"),
                                enhet_orgnr=r.get("enhet_orgnr"),
                                fratraadt=r.get("fratraadt", False),
                                rekkefoelge=r.get("rekkefoelge"),
                            )
                            for r in roles_data
                        ]

                        if self.repair:
                            await self.db.execute(delete(models.Role).where(models.Role.orgnr == company.orgnr))
                            if role_models:
                                await self.role_repo.create_batch(role_models, commit=False)
                            await self.company_repo.update_last_polled_roles(company.orgnr)
                    except Exception as e:
                        logger.error(f"Role backfill failed for {company.orgnr}: {e}")
                        await self.update_service.report_sync_error(company.orgnr, "role", str(e))

        if self.repair:
            await self.db.commit()

    async def _repair_company(self, orgnr: str) -> bool:
        async with repair_semaphore:
            async with repair_limiter:
                try:
                    data = await self.brreg_api.fetch_company(orgnr)
                    if data:
                        await self.company_repo.create_or_update(data)
                        return True
                    return False
                except Exception as e:
                    logger.error(f"Failed to repair company {orgnr}: {e}")
                    return False
