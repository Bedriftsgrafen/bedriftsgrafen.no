import math
from typing import Any

import models


class KpiService:
    """
    Service for calculating Key Performance Indicators (KPIs)
    from financial data using Norwegian financial terms
    """

    @staticmethod
    def _safe_divide(numerator: float | None, denominator: float | None) -> float | None:
        """
        Safely divide two numbers, returning None if division is invalid.

        Handles:
        - None/null values
        - Zero denominators
        - Infinity or NaN results

        Note: Allows negative denominators for ratios involving negative values
        (e.g., negative equity)

        Args:
            numerator: The dividend
            denominator: The divisor

        Returns:
            Result of division or None if invalid
        """
        if numerator is None or denominator is None or denominator == 0:
            return None
        result = numerator / denominator
        # Reject Infinity/NaN edge cases from floating point errors
        return result if math.isfinite(result) else None

    @staticmethod
    def calculate_likviditetsgrad1(accounting: models.Accounting) -> float | None:
        """
        Calculate Liquidity Ratio 1 (Current Ratio)
        Formula: omloepsmidler / kortsiktig_gjeld

        Only calculated when kortsiktig_gjeld > 0 (negative debt is not meaningful)
        """
        if accounting.kortsiktig_gjeld is None or accounting.kortsiktig_gjeld <= 0:
            return None
        return KpiService._safe_divide(accounting.omloepsmidler, accounting.kortsiktig_gjeld)

    @staticmethod
    def calculate_ebitda(accounting: models.Accounting) -> float | None:
        """
        Calculate EBITDA
        Formula: driftsresultat + avskrivninger
        """
        if accounting.driftsresultat is not None and accounting.avskrivninger is not None:
            return accounting.driftsresultat + accounting.avskrivninger
        elif accounting.driftsresultat is not None:
            return accounting.driftsresultat
        return None

    @staticmethod
    def calculate_ebitda_margin(accounting: models.Accounting) -> float | None:
        """
        Calculate EBITDA Margin
        Formula: (driftsresultat + avskrivninger) / salgsinntekter

        Only calculated when salgsinntekter > 0
        """
        if accounting.salgsinntekter is None or accounting.salgsinntekter <= 0:
            return None
        ebitda = KpiService.calculate_ebitda(accounting)
        return KpiService._safe_divide(ebitda, accounting.salgsinntekter)

    @staticmethod
    def calculate_egenkapitalandel(accounting: models.Accounting) -> float | None:
        """
        Calculate Equity Ratio
        Formula: egenkapital / (egenkapital + total_gjeld)
        """
        if accounting.egenkapital is None or accounting.egenkapital <= 0:
            return None
        total_gjeld = (accounting.kortsiktig_gjeld or 0) + (accounting.langsiktig_gjeld or 0)
        total_kapital = accounting.egenkapital + total_gjeld
        return KpiService._safe_divide(accounting.egenkapital, total_kapital)

    @staticmethod
    def calculate_resultatgrad(accounting: models.Accounting) -> float | None:
        """
        Calculate Profit Margin
        Formula: aarsresultat / salgsinntekter

        Only calculated when salgsinntekter > 0
        """
        if accounting.salgsinntekter is None or accounting.salgsinntekter <= 0:
            return None
        return KpiService._safe_divide(accounting.aarsresultat, accounting.salgsinntekter)

    @staticmethod
    def calculate_totalkapitalrentabilitet(accounting: models.Accounting) -> float | None:
        """
        Calculate Return on Assets (ROA)
        Formula: aarsresultat / sum_eiendeler
        Note: sum_eiendeler = anleggsmidler + omloepsmidler

        Only calculated when sum_eiendeler > 0
        """
        sum_eiendeler = (accounting.anleggsmidler or 0) + (accounting.omloepsmidler or 0)
        if sum_eiendeler <= 0:
            return None
        return KpiService._safe_divide(accounting.aarsresultat, sum_eiendeler)

    @staticmethod
    def calculate_all_kpis(accounting: models.Accounting) -> dict[str, Any]:
        """
        Calculate all KPIs for an accounting record

        Returns:
            Dictionary with all calculated KPIs
        """
        return {
            "likviditetsgrad1": KpiService.calculate_likviditetsgrad1(accounting),
            "ebitda": KpiService.calculate_ebitda(accounting),
            "ebitda_margin": KpiService.calculate_ebitda_margin(accounting),
            "egenkapitalandel": KpiService.calculate_egenkapitalandel(accounting),
            "resultatgrad": KpiService.calculate_resultatgrad(accounting),
            "totalkapitalrentabilitet": KpiService.calculate_totalkapitalrentabilitet(accounting),
        }
