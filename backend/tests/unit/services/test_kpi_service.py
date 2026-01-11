"""
Unit tests for KpiService.

Tests all KPI calculation methods with various edge cases.
Follows AAA pattern (Arrange - Act - Assert).
"""

from unittest.mock import MagicMock

from services.kpi_service import KpiService


class TestKpiServiceSafeDivide:
    """Tests for the _safe_divide helper method."""

    def test_safe_divide_valid_numbers(self):
        # Arrange & Act
        result = KpiService._safe_divide(100, 50)

        # Assert
        assert result == 2.0

    def test_safe_divide_zero_denominator_returns_none(self):
        result = KpiService._safe_divide(100, 0)
        assert result is None

    def test_safe_divide_none_numerator_returns_none(self):
        result = KpiService._safe_divide(None, 50)
        assert result is None

    def test_safe_divide_none_denominator_returns_none(self):
        result = KpiService._safe_divide(100, None)
        assert result is None

    def test_safe_divide_both_none_returns_none(self):
        result = KpiService._safe_divide(None, None)
        assert result is None

    def test_safe_divide_negative_values(self):
        result = KpiService._safe_divide(-100, 50)
        assert result == -2.0


class TestLikviditetsgrad1:
    """Tests for Liquidity Ratio 1 (Current Ratio) calculation."""

    def test_calculate_likviditetsgrad1_valid_data(self):
        # Arrange - Create mock accounting with real attributes
        accounting = MagicMock()
        accounting.omloepsmidler = 1000000
        accounting.kortsiktig_gjeld = 500000

        # Act
        result = KpiService.calculate_likviditetsgrad1(accounting)

        # Assert
        assert result == 2.0

    def test_calculate_likviditetsgrad1_zero_gjeld_returns_none(self):
        accounting = MagicMock()
        accounting.omloepsmidler = 1000000
        accounting.kortsiktig_gjeld = 0

        result = KpiService.calculate_likviditetsgrad1(accounting)
        assert result is None

    def test_calculate_likviditetsgrad1_negative_gjeld_returns_none(self):
        accounting = MagicMock()
        accounting.omloepsmidler = 1000000
        accounting.kortsiktig_gjeld = -500000

        result = KpiService.calculate_likviditetsgrad1(accounting)
        assert result is None

    def test_calculate_likviditetsgrad1_none_gjeld_returns_none(self):
        accounting = MagicMock()
        accounting.omloepsmidler = 1000000
        accounting.kortsiktig_gjeld = None

        result = KpiService.calculate_likviditetsgrad1(accounting)
        assert result is None


class TestEbitda:
    """Tests for EBITDA calculation."""

    def test_calculate_ebitda_with_avskrivninger(self):
        accounting = MagicMock()
        accounting.driftsresultat = 500000
        accounting.avskrivninger = 100000

        result = KpiService.calculate_ebitda(accounting)
        assert result == 600000

    def test_calculate_ebitda_zero_avskrivninger(self):
        accounting = MagicMock()
        accounting.driftsresultat = 500000
        accounting.avskrivninger = 0

        result = KpiService.calculate_ebitda(accounting)
        assert result == 500000

    def test_calculate_ebitda_none_avskrivninger(self):
        accounting = MagicMock()
        accounting.driftsresultat = 500000
        accounting.avskrivninger = None

        result = KpiService.calculate_ebitda(accounting)
        assert result == 500000

    def test_calculate_ebitda_none_driftsresultat_returns_none(self):
        accounting = MagicMock()
        accounting.driftsresultat = None
        accounting.avskrivninger = 100000

        result = KpiService.calculate_ebitda(accounting)
        assert result is None

    def test_calculate_ebitda_negative_driftsresultat(self):
        accounting = MagicMock()
        accounting.driftsresultat = -200000
        accounting.avskrivninger = 100000

        result = KpiService.calculate_ebitda(accounting)
        assert result == -100000


class TestEbitdaMargin:
    """Tests for EBITDA Margin calculation."""

    def test_calculate_ebitda_margin_valid(self):
        accounting = MagicMock()
        accounting.driftsresultat = 400000
        accounting.avskrivninger = 100000
        accounting.salgsinntekter = 2000000

        result = KpiService.calculate_ebitda_margin(accounting)
        assert result == 0.25  # 25% margin

    def test_calculate_ebitda_margin_zero_salgsinntekter_returns_none(self):
        accounting = MagicMock()
        accounting.driftsresultat = 400000
        accounting.avskrivninger = 100000
        accounting.salgsinntekter = 0

        result = KpiService.calculate_ebitda_margin(accounting)
        assert result is None

    def test_calculate_ebitda_margin_none_salgsinntekter_returns_none(self):
        accounting = MagicMock()
        accounting.driftsresultat = 400000
        accounting.avskrivninger = 100000
        accounting.salgsinntekter = None

        result = KpiService.calculate_ebitda_margin(accounting)
        assert result is None

    def test_calculate_ebitda_margin_negative_returns_none(self):
        accounting = MagicMock()
        accounting.driftsresultat = 400000
        accounting.avskrivninger = 100000
        accounting.salgsinntekter = -1000000

        result = KpiService.calculate_ebitda_margin(accounting)
        assert result is None


class TestEgenkapitalandel:
    """Tests for Equity Ratio calculation."""

    def test_calculate_egenkapitalandel_valid(self):
        accounting = MagicMock()
        accounting.egenkapital = 3000000
        accounting.kortsiktig_gjeld = 1000000
        accounting.langsiktig_gjeld = 2000000

        result = KpiService.calculate_egenkapitalandel(accounting)
        # 3M / (3M + 1M + 2M) = 3M / 6M = 0.5
        assert result == 0.5

    def test_calculate_egenkapitalandel_none_gjeld_uses_zero(self):
        accounting = MagicMock()
        accounting.egenkapital = 3000000
        accounting.kortsiktig_gjeld = None
        accounting.langsiktig_gjeld = None

        result = KpiService.calculate_egenkapitalandel(accounting)
        # 3M / (3M + 0 + 0) = 1.0
        assert result == 1.0

    def test_calculate_egenkapitalandel_negative_egenkapital_returns_none(self):
        accounting = MagicMock()
        accounting.egenkapital = -500000
        accounting.kortsiktig_gjeld = 1000000
        accounting.langsiktig_gjeld = 500000

        result = KpiService.calculate_egenkapitalandel(accounting)
        assert result is None

    def test_calculate_egenkapitalandel_zero_egenkapital_returns_none(self):
        accounting = MagicMock()
        accounting.egenkapital = 0
        accounting.kortsiktig_gjeld = 1000000
        accounting.langsiktig_gjeld = 500000

        result = KpiService.calculate_egenkapitalandel(accounting)
        assert result is None


class TestResultatgrad:
    """Tests for Profit Margin calculation."""

    def test_calculate_resultatgrad_valid(self):
        accounting = MagicMock()
        accounting.aarsresultat = 500000
        accounting.salgsinntekter = 5000000

        result = KpiService.calculate_resultatgrad(accounting)
        assert result == 0.1  # 10% margin

    def test_calculate_resultatgrad_zero_salgsinntekter_returns_none(self):
        accounting = MagicMock()
        accounting.aarsresultat = 500000
        accounting.salgsinntekter = 0

        result = KpiService.calculate_resultatgrad(accounting)
        assert result is None

    def test_calculate_resultatgrad_negative_salgsinntekter_returns_none(self):
        accounting = MagicMock()
        accounting.aarsresultat = 500000
        accounting.salgsinntekter = -1000000

        result = KpiService.calculate_resultatgrad(accounting)
        assert result is None

    def test_calculate_resultatgrad_negative_aarsresultat(self):
        accounting = MagicMock()
        accounting.aarsresultat = -200000
        accounting.salgsinntekter = 2000000

        result = KpiService.calculate_resultatgrad(accounting)
        assert result == -0.1  # -10% margin (loss)


class TestTotalkapitalrentabilitet:
    """Tests for Return on Assets (ROA) calculation."""

    def test_calculate_totalkapitalrentabilitet_valid(self):
        accounting = MagicMock()
        accounting.aarsresultat = 500000
        accounting.anleggsmidler = 3000000
        accounting.omloepsmidler = 2000000

        result = KpiService.calculate_totalkapitalrentabilitet(accounting)
        # 500K / (3M + 2M) = 500K / 5M = 0.1
        assert result == 0.1

    def test_calculate_totalkapitalrentabilitet_zero_eiendeler_returns_none(self):
        accounting = MagicMock()
        accounting.aarsresultat = 500000
        accounting.anleggsmidler = 0
        accounting.omloepsmidler = 0

        result = KpiService.calculate_totalkapitalrentabilitet(accounting)
        assert result is None

    def test_calculate_totalkapitalrentabilitet_none_eiendeler_uses_zero(self):
        accounting = MagicMock()
        accounting.aarsresultat = 500000
        accounting.anleggsmidler = None
        accounting.omloepsmidler = 2000000

        result = KpiService.calculate_totalkapitalrentabilitet(accounting)
        # 500K / (0 + 2M) = 0.25
        assert result == 0.25


class TestCalculateAllKpis:
    """Tests for the calculate_all_kpis aggregate method."""

    def test_calculate_all_kpis_returns_dict_with_all_keys(self):
        accounting = MagicMock()
        accounting.driftsresultat = 1000000
        accounting.avskrivninger = 200000
        accounting.salgsinntekter = 5000000
        accounting.aarsresultat = 800000
        accounting.egenkapital = 3000000
        accounting.kortsiktig_gjeld = 1000000
        accounting.langsiktig_gjeld = 1000000
        accounting.omloepsmidler = 2000000
        accounting.anleggsmidler = 3000000

        result = KpiService.calculate_all_kpis(accounting)

        # Assert all keys are present
        assert "likviditetsgrad1" in result
        assert "ebitda" in result
        assert "ebitda_margin" in result
        assert "egenkapitalandel" in result
        assert "resultatgrad" in result
        assert "totalkapitalrentabilitet" in result

    def test_calculate_all_kpis_with_complete_data(self):
        accounting = MagicMock()
        accounting.driftsresultat = 1000000
        accounting.avskrivninger = 200000
        accounting.salgsinntekter = 5000000
        accounting.aarsresultat = 800000
        accounting.egenkapital = 3000000
        accounting.kortsiktig_gjeld = 1000000
        accounting.langsiktig_gjeld = 1000000
        accounting.omloepsmidler = 2000000
        accounting.anleggsmidler = 3000000

        result = KpiService.calculate_all_kpis(accounting)

        # Verify calculations
        assert result["likviditetsgrad1"] == 2.0  # 2M / 1M
        assert result["ebitda"] == 1200000  # 1M + 200K
        assert result["ebitda_margin"] == 0.24  # 1.2M / 5M
        assert result["egenkapitalandel"] == 0.6  # 3M / 5M
        assert result["resultatgrad"] == 0.16  # 800K / 5M
        assert result["totalkapitalrentabilitet"] == 0.16  # 800K / 5M
