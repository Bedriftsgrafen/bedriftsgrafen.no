"""Service for SEO related operations like dynamic OG images and sitemaps."""

import html
import textwrap
from typing import Any, Dict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models
from constants.nace import get_nace_name
from repositories.company.repository import CompanyRepository


class SEOService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.company_repo = CompanyRepository(db)

    async def get_company_og_data(self, orgnr: str) -> Dict[str, Any] | None:
        """Fetch optimized data for company OG image."""
        # Query only needed fields for performance
        query = (
            select(
                models.Company.navn,
                models.Company.naeringskode,
                models.Company.antall_ansatte,
                models.LatestFinancials.salgsinntekter,
                models.LatestFinancials.aarsresultat,
            )
            .outerjoin(models.LatestFinancials, models.Company.orgnr == models.LatestFinancials.orgnr)
            .where(models.Company.orgnr == orgnr)
        )

        result = await self.db.execute(query)
        row = result.first()

        if not row:
            return None

        nace_desc = get_nace_name(row.naeringskode) if row.naeringskode else "Bedrift"

        return {
            "navn": row.navn or "Ukjent Bedrift",
            "orgnr": orgnr,
            "nace_name": nace_desc,
            "revenue": row.salgsinntekter,
            "profit": row.aarsresultat,
            "employees": row.antall_ansatte,
        }

    def generate_company_og_svg(self, data: Dict[str, Any]) -> str:
        """Generates a dynamic SVG OpenGraph card for a company."""
        # Sanitize inputs for SVG safety
        name = html.escape(data["navn"])
        orgnr = html.escape(data["orgnr"])
        industry = html.escape(data["nace_name"])

        # Format numbers
        def format_curr(val):
            if val is None:
                return "—"
            if val >= 1_000_000:
                return f"{val / 1_000_000:.1f}M".replace(".", ",")
            if val >= 1_000:
                return f"{val / 1_000:.0f}K".replace(".", ",")
            return str(val)

        rev = format_curr(data["revenue"])
        prof = format_curr(data["profit"])
        emp = data["employees"] if data["employees"] is not None else "—"

        # SVG template - optimized for high-impact social sharing
        svg = f"""
        <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="1200" height="630" fill="url(#grad)" />
            
            <!-- Pattern -->
            <circle cx="1100" cy="100" r="250" fill="white" opacity="0.03" />
            <rect x="50" y="50" width="1100" height="530" rx="30" fill="none" stroke="white" stroke-opacity="0.1" stroke-width="2" />

            <!-- Brand -->
            <text x="80" y="100" font-family="sans-serif" font-size="28" font-weight="bold" fill="#60a5fa">BEDRIFTSGRAFEN.NO</text>
            
            <!-- Company Info -->
            <text x="80" y="240" font-family="sans-serif" font-size="64" font-weight="900" fill="white">{name[:60]}{"..." if len(name) > 60 else ""}</text>
            <text x="80" y="300" font-family="sans-serif" font-size="28" font-weight="bold" fill="#94a3b8">{industry[:70]}{"..." if len(industry) > 70 else ""}</text>
            <text x="80" y="345" font-family="sans-serif" font-size="24" fill="#64748b">Org.nr: {orgnr}</text>
            
            <!-- Stats Row -->
            <g transform="translate(80, 480)">
                <text x="0" y="0" font-family="sans-serif" font-size="20" font-weight="bold" fill="#94a3b8" letter-spacing="2">OMSETNING</text>
                <text x="0" y="55" font-family="sans-serif" font-size="64" font-weight="bold" fill="white">{rev}</text>
            </g>
            
            <g transform="translate(450, 480)">
                <text x="0" y="0" font-family="sans-serif" font-size="20" font-weight="bold" fill="#94a3b8" letter-spacing="2">ÅRSRESULTAT</text>
                <text x="0" y="55" font-family="sans-serif" font-size="64" font-weight="bold" fill="white">{prof}</text>
            </g>

            <g transform="translate(850, 480)">
                <text x="0" y="0" font-family="sans-serif" font-size="20" font-weight="bold" fill="#94a3b8" letter-spacing="2">ANSATTE</text>
                <text x="0" y="55" font-family="sans-serif" font-size="64" font-weight="bold" fill="white">{emp}</text>
            </g>
            
            <!-- Status Pill -->
            <rect x="80" y="130" width="120" height="32" rx="16" fill="#3b82f6" opacity="0.2" />
            <text x="140" y="152" font-family="sans-serif" font-size="14" font-weight="bold" fill="#93c5fd" text-anchor="middle">OFFISIELL DATA</text>

            <!-- Bottom Line -->
            <rect x="0" y="620" width="1200" height="10" fill="#3b82f6" />
        </svg>
        """
        return textwrap.dedent(svg)
