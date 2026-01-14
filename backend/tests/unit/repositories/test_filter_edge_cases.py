from repositories.company_filter_builder import FilterParams


def test_filter_params_is_empty_with_booleans():
    """Verify that is_empty correctly handles boolean False values."""
    # All None - should be empty
    params = FilterParams()
    assert params.is_empty() is True

    # has_accounting=False - should NOT be empty
    params = FilterParams(has_accounting=False)
    assert params.is_empty() is False

    # is_bankrupt=False - should NOT be empty (it's a filter explicitly for non-bankrupt)
    params = FilterParams(is_bankrupt=False)
    assert params.is_empty() is False


def test_filter_params_is_empty_with_zeros():
    """Verify that is_empty correctly handles numeric zero values."""
    # min_employees=0 - should NOT be empty
    params = FilterParams(min_employees=0)
    assert params.is_empty() is False


def test_has_only_org_form_filter_with_booleans():
    """Verify that has_only_org_form_filter correctly handles other boolean filters."""
    # Only org form
    params = FilterParams(organisasjonsform=["AS"])
    assert params.has_only_org_form_filter() is True

    # Org form + has_accounting=False - should be False
    params = FilterParams(organisasjonsform=["AS"], has_accounting=False)
    assert params.has_only_org_form_filter() is False

    # Org form + in_liquidation=False - should be False
    params = FilterParams(organisasjonsform=["AS"], in_liquidation=False)
    assert params.has_only_org_form_filter() is False
