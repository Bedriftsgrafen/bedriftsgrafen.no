from utils.nace_codes import is_nace_section_letter, get_nace_division_prefixes, get_nace_section_name


def test_is_nace_section_letter():
    assert is_nace_section_letter("A") is True
    assert is_nace_section_letter("a") is True
    assert is_nace_section_letter("Z") is False  # Invalid section
    assert is_nace_section_letter("62") is False
    assert is_nace_section_letter(None) is False


def test_get_nace_division_prefixes():
    # Section mappings
    assert "41" in get_nace_division_prefixes("F")
    assert "42" in get_nace_division_prefixes("F")

    # Passthrough
    assert get_nace_division_prefixes("62") == ["62"]

    # None/Empty
    assert get_nace_division_prefixes(None) == []


def test_get_nace_section_name():
    assert get_nace_section_name("A") == "Jordbruk, skogbruk og fiske"
    assert get_nace_section_name("z") is None
