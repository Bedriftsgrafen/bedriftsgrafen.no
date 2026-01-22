"""API endpoints for Dynamic OpenGraph (OG) images."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
import textwrap

from database import get_db
from services.stats_service import StatsService

router = APIRouter(prefix="/v1/og", tags=["seo"])

@router.get("/municipality/{code}.svg")
async def get_municipality_og_svg(
    code: str,
    db: AsyncSession = Depends(get_db)
):
    """Generates a dynamic SVG OpenGraph card for a municipality."""
    service = StatsService(db)
    dashboard = await service.get_municipality_premium_dashboard(code)
    
    if not dashboard:
        return Response(status_code=404)
        
    name = dashboard["name"]
    pop = f"{dashboard['population']:,}".replace(",", " ")
    growth = f"{dashboard['population_growth_1y']:+.1f}%" if dashboard['population_growth_1y'] else "Ny"
    count = f"{dashboard['company_count']:,}".replace(",", " ")
    
    # Simple, high-impact SVG card
    svg = f"""
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#grad)" />
        
        <!-- Background Pattern -->
        <circle cx="1100" cy="100" r="200" fill="white" opacity="0.03" />
        <circle cx="100" cy="530" r="150" fill="white" opacity="0.03" />

        <!-- Logo/Brand -->
        <text x="60" y="80" font-family="sans-serif" font-size="32" font-weight="bold" fill="#3b82f6">Bedriftsgrafen.no</text>
        
        <!-- Content -->
        <text x="60" y="240" font-family="sans-serif" font-size="84" font-weight="bold" fill="white">{name}</text>
        <text x="60" y="310" font-family="sans-serif" font-size="32" fill="#94a3b8">Næringsrapport &amp; Demografi</text>
        
        <!-- Stats Grid -->
        <g transform="translate(60, 420)">
            <text x="0" y="0" font-family="sans-serif" font-size="24" fill="#94a3b8">FOLKETALL</text>
            <text x="0" y="50" font-family="sans-serif" font-size="64" font-weight="bold" fill="white">{pop}</text>
            <text x="0" y="90" font-family="sans-serif" font-size="24" fill="#10b981">{growth} vekst</text>
        </g>
        
        <g transform="translate(450, 420)">
            <text x="0" y="0" font-family="sans-serif" font-size="24" fill="#94a3b8">BEDRIFTER</text>
            <text x="0" y="50" font-family="sans-serif" font-size="64" font-weight="bold" fill="white">{count}</text>
            <text x="0" y="90" font-family="sans-serif" font-size="24" fill="#3b82f6">Lokal innsikt</text>
        </g>
        
        <!-- Footer -->
        <rect x="0" y="620" width="1200" height="10" fill="#3b82f6" />
    </svg>
    """
    
    return Response(content=textwrap.dedent(svg), media_type="image/svg+xml")
