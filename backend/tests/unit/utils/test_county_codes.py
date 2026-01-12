from utils.county_codes import get_county_code, get_county_name, is_county_code

def test_get_county_code():
    assert get_county_code("Oslo") == "03"
    assert get_county_code("oslo") == "03" # Case insensitive
    assert get_county_code("Invalid") is None

def test_get_county_name():
    assert get_county_name("03") == "Oslo"
    assert get_county_name("3") == "Oslo" # Normalization
    assert get_county_name("99") is None

def test_is_county_code():
    assert is_county_code("03") is True
    assert is_county_code("3") is False # Expects 2 digits as per is_county_code logic (usually)
    # Checking implementation: "len(value) == 2"
    assert is_county_code("99") is False # Invalid code
