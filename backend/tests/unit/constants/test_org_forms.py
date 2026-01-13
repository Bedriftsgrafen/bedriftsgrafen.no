"""
MECE Unit Tests for org_forms.py - Legal Filtering Logic

Test Categories:
1. COMMERCIAL_ORG_FORMS - Whitelist validation
2. NON_COMMERCIAL_ORG_FORMS - Blacklist validation
3. is_commercial_role() - Decision logic for all cases
"""

import pytest
from constants.org_forms import (
    COMMERCIAL_ORG_FORMS,
    NON_COMMERCIAL_ORG_FORMS,
    FOUNDATION_ORG_FORM,
    is_commercial_role,
)


class TestCommercialOrgForms:
    """Tests for the commercial organizational forms whitelist."""

    def test_contains_expected_commercial_forms(self):
        """All expected commercial forms are in the whitelist."""
        expected = {"AS", "ASA", "ENK", "ANS", "DA", "NUF", "KS", "SAM", "IKS"}
        assert expected == COMMERCIAL_ORG_FORMS

    def test_does_not_contain_non_commercial_forms(self):
        """Commercial whitelist does not overlap with blacklist."""
        overlap = COMMERCIAL_ORG_FORMS & NON_COMMERCIAL_ORG_FORMS
        assert len(overlap) == 0, f"Unexpected overlap: {overlap}"

    def test_does_not_contain_foundation(self):
        """STI (Foundation) is NOT in the commercial whitelist."""
        assert FOUNDATION_ORG_FORM not in COMMERCIAL_ORG_FORMS


class TestNonCommercialOrgForms:
    """Tests for the non-commercial organizational forms blacklist."""

    def test_contains_expected_non_commercial_forms(self):
        """All expected non-commercial forms are in the blacklist."""
        expected = {"FLI", "BRL", "ESEK", "ANNA"}
        assert expected == NON_COMMERCIAL_ORG_FORMS

    def test_includes_housing_cooperatives(self):
        """BRL (Borettslag) is explicitly blacklisted."""
        assert "BRL" in NON_COMMERCIAL_ORG_FORMS

    def test_includes_voluntary_organizations(self):
        """FLI (Forening/lag/innretning) is explicitly blacklisted."""
        assert "FLI" in NON_COMMERCIAL_ORG_FORMS

    def test_includes_condominiums(self):
        """ESEK (Eierseksjonssameie) is explicitly blacklisted."""
        assert "ESEK" in NON_COMMERCIAL_ORG_FORMS


class TestIsCommercialRole:
    """
    MECE tests for is_commercial_role() decision logic.

    Decision Matrix:
    | registrert_i_foretaksreg | org_form in whitelist | org_form in blacklist | Result |
    |--------------------------|----------------------|----------------------|--------|
    | True                     | Any                  | Any                  | True   |
    | False                    | True                 | False                | True   |
    | False                    | False                | True                 | False  |
    | False                    | False                | False                | False  |
    | False                    | STI                  | -                    | False  |
    """

    # Case 1: Registered in Foretaksregisteret (always commercial)
    @pytest.mark.parametrize("org_form", ["AS", "FLI", "BRL", "STI", "UNKNOWN"])
    def test_registered_in_foretaksreg_always_commercial(self, org_form: str):
        """If registered in Foretaksregisteret, ALWAYS commercial regardless of org form."""
        assert is_commercial_role(org_form, is_registered_in_foretaksreg=True) is True

    # Case 2: Not registered, but in commercial whitelist
    @pytest.mark.parametrize("org_form", list(COMMERCIAL_ORG_FORMS))
    def test_not_registered_but_in_whitelist_is_commercial(self, org_form: str):
        """Commercial org forms are considered commercial even without Foretaksreg."""
        assert is_commercial_role(org_form, is_registered_in_foretaksreg=False) is True

    # Case 3: Not registered and in blacklist
    @pytest.mark.parametrize("org_form", list(NON_COMMERCIAL_ORG_FORMS))
    def test_not_registered_and_in_blacklist_is_not_commercial(self, org_form: str):
        """Non-commercial org forms are NEVER commercial without Foretaksreg."""
        assert is_commercial_role(org_form, is_registered_in_foretaksreg=False) is False

    # Case 4: Foundation (STI) without Foretaksreg
    def test_foundation_without_foretaksreg_is_not_commercial(self):
        """STI (Stiftelse) is NOT commercial unless registered in Foretaksreg."""
        assert is_commercial_role("STI", is_registered_in_foretaksreg=False) is False

    # Case 5: Foundation (STI) WITH Foretaksreg
    def test_foundation_with_foretaksreg_is_commercial(self):
        """STI (Stiftelse) IS commercial when registered in Foretaksreg."""
        assert is_commercial_role("STI", is_registered_in_foretaksreg=True) is True

    # Case 6: Unknown org form
    def test_unknown_org_form_without_foretaksreg_defaults_to_not_commercial(self):
        """Unknown org forms default to NOT commercial for safety."""
        assert is_commercial_role("UNKNOWN_FORM", is_registered_in_foretaksreg=False) is False

    # Case 7: Empty org form string
    def test_empty_org_form_defaults_to_not_commercial(self):
        """Empty org form string is NOT commercial."""
        assert is_commercial_role("", is_registered_in_foretaksreg=False) is False


class TestLegalCompliance:
    """Tests ensuring Enhetsregisterloven § 22 compliance."""

    def test_borettslag_never_shown_without_foretaksreg(self):
        """BRL must never appear in person-role mapping without Foretaksreg."""
        # This is critical for privacy compliance
        assert is_commercial_role("BRL", False) is False

    def test_voluntary_org_never_shown_without_foretaksreg(self):
        """FLI must never appear in person-role mapping without Foretaksreg."""
        assert is_commercial_role("FLI", False) is False

    def test_aksjeselskap_always_shown(self):
        """AS (Aksjeselskap) should always be considered commercial."""
        assert is_commercial_role("AS", False) is True
        assert is_commercial_role("AS", True) is True
