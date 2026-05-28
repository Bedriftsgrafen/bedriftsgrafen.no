from utils.nace_codes import get_nace_division_prefixes, get_nace_section_name, is_nace_section_letter


def test_is_nace_section_letter():
    assert is_nace_section_letter("A") is True
    assert is_nace_section_letter("a") is True
    assert is_nace_section_letter("V") is True
    assert is_nace_section_letter("Z") is False  # Invalid section
    assert is_nace_section_letter("62") is False
    assert is_nace_section_letter(None) is False


def test_get_nace_division_prefixes():
    # Section mappings
    assert "41" in get_nace_division_prefixes("F")
    assert "42" in get_nace_division_prefixes("F")
    assert get_nace_division_prefixes("U") == ["97", "98"]
    assert get_nace_division_prefixes("V") == ["99"]

    # Passthrough
    assert get_nace_division_prefixes("62") == ["62"]

    # None/Empty
    assert get_nace_division_prefixes(None) == []


def test_get_nace_section_name():
    assert get_nace_section_name("A") == "Jordbruk, skogbruk og fiske"
    assert get_nace_section_name("V") == "Internasjonale organisasjoner og organer"
    assert get_nace_section_name("z") is None
