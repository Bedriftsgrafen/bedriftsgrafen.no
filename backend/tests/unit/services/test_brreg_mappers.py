"""Tests for brreg_mappers module - shared API data transformation utilities."""

from datetime import date

import pytest

import models
from services.brreg_mappers import map_subunit_from_api, parse_brreg_date


class TestParseBrregDate:
    """Tests for parse_brreg_date function."""

    def test_parse_valid_date_string(self):
        """Should parse YYYY-MM-DD format correctly."""
        result = parse_brreg_date("2023-05-15")
        assert result == date(2023, 5, 15)

    def test_parse_iso_datetime_string(self):
        """Should extract date from ISO datetime format."""
        result = parse_brreg_date("2023-05-15T00:00:00")
        assert result == date(2023, 5, 15)

    def test_parse_iso_with_timezone(self):
        """Should extract date from ISO datetime with timezone."""
        result = parse_brreg_date("2023-05-15T12:30:45+02:00")
        assert result == date(2023, 5, 15)

    def test_returns_none_for_none_input(self):
        """Should return None when input is None."""
        assert parse_brreg_date(None) is None

    def test_returns_none_for_empty_string(self):
        """Should return None for empty string."""
        assert parse_brreg_date("") is None

    def test_returns_none_for_non_string(self):
        """Should return None for non-string input."""
        assert parse_brreg_date(12345) is None
        assert parse_brreg_date({"date": "2023-01-01"}) is None

    def test_returns_none_for_invalid_format(self):
        """Should return None for invalid date formats."""
        assert parse_brreg_date("15-05-2023") is None  # DD-MM-YYYY
        assert parse_brreg_date("invalid") is None
        assert parse_brreg_date("2023/05/15") is None


class TestMapSubunitFromApi:
    """Tests for map_subunit_from_api function."""

    @pytest.fixture
    def sample_api_response(self) -> dict:
        """Complete sample API response from Brønnøysund /underenheter endpoint."""
        return {
            "organisasjonsnummer": "999888777",
            "navn": "Test Filial Oslo",
            "organisasjonsform": {"kode": "BEDR", "beskrivelse": "Bedrift"},
            "naeringskode1": {"kode": "62.010", "beskrivelse": "Programmeringstjenester"},
            "antallAnsatte": 15,
            "beliggenhetsadresse": {
                "land": "Norge",
                "landkode": "NO",
                "postnummer": "0150",
                "poststed": "OSLO",
                "adresse": ["Karl Johans gate 1"],
                "kommune": "OSLO",
                "kommunenummer": "0301",
            },
            "postadresse": {
                "land": "Norge",
                "landkode": "NO",
                "postnummer": "0150",
                "poststed": "OSLO",
                "adresse": ["Postboks 123"],
            },
            "stiftelsesdato": "2020-03-15",
            "registreringsdatoEnhetsregisteret": "2020-04-01",
            "overordnetEnhet": "123456789",
            "_links": {"self": {"href": "https://data.brreg.no/enhetsregisteret/api/underenheter/999888777"}},
        }

    def test_maps_organisasjonsnummer_to_orgnr(self, sample_api_response):
        """API field 'organisasjonsnummer' should map to model field 'orgnr'."""
        result = map_subunit_from_api(sample_api_response, "123456789")
        assert result.orgnr == "999888777"

    def test_maps_navn_directly(self, sample_api_response):
        """Field 'navn' should be mapped directly."""
        result = map_subunit_from_api(sample_api_response, "123456789")
        assert result.navn == "Test Filial Oslo"

    def test_sets_parent_orgnr_from_parameter(self, sample_api_response):
        """parent_orgnr should be set from function parameter, not API response."""
        result = map_subunit_from_api(sample_api_response, "111222333")
        assert result.parent_orgnr == "111222333"

    def test_extracts_organisasjonsform_kode(self, sample_api_response):
        """Should extract 'kode' from nested organisasjonsform object."""
        result = map_subunit_from_api(sample_api_response, "123456789")
        assert result.organisasjonsform == "BEDR"

    def test_extracts_naeringskode1_kode(self, sample_api_response):
        """Should extract 'kode' from nested naeringskode1 object."""
        result = map_subunit_from_api(sample_api_response, "123456789")
        assert result.naeringskode == "62.010"

    def test_maps_antallAnsatte_to_antall_ansatte(self, sample_api_response):
        """API field 'antallAnsatte' should map to model field 'antall_ansatte'."""
        result = map_subunit_from_api(sample_api_response, "123456789")
        assert result.antall_ansatte == 15

    def test_maps_beliggenhetsadresse_directly(self, sample_api_response):
        """beliggenhetsadresse should be stored as complete JSONB dict."""
        result = map_subunit_from_api(sample_api_response, "123456789")
        assert result.beliggenhetsadresse == sample_api_response["beliggenhetsadresse"]
        assert result.beliggenhetsadresse["postnummer"] == "0150"

    def test_maps_postadresse_directly(self, sample_api_response):
        """postadresse should be stored as complete JSONB dict."""
        result = map_subunit_from_api(sample_api_response, "123456789")
        assert result.postadresse == sample_api_response["postadresse"]

    def test_parses_stiftelsesdato(self, sample_api_response):
        """stiftelsesdato should be parsed from string to date."""
        result = map_subunit_from_api(sample_api_response, "123456789")
        assert result.stiftelsesdato == date(2020, 3, 15)

    def test_parses_registreringsdato_enhetsregisteret(self, sample_api_response):
        """registreringsdatoEnhetsregisteret should be parsed to date."""
        result = map_subunit_from_api(sample_api_response, "123456789")
        assert result.registreringsdato_enhetsregisteret == date(2020, 4, 1)

    def test_stores_raw_data(self, sample_api_response):
        """raw_data should contain the original API response for future-proofing."""
        result = map_subunit_from_api(sample_api_response, "123456789")
        assert result.raw_data == sample_api_response
        # Verify _links are preserved (Brønnøysund includes these)
        assert "_links" in result.raw_data

    def test_returns_subunit_model_instance(self, sample_api_response):
        """Should return a models.SubUnit instance."""
        result = map_subunit_from_api(sample_api_response, "123456789")
        assert isinstance(result, models.SubUnit)

    def test_handles_missing_organisasjonsform(self):
        """Should handle missing organisasjonsform gracefully."""
        data = {"organisasjonsnummer": "123", "navn": "Test"}
        result = map_subunit_from_api(data, "parent")
        assert result.organisasjonsform is None

    def test_handles_missing_naeringskode1(self):
        """Should handle missing naeringskode1 gracefully."""
        data = {"organisasjonsnummer": "123", "navn": "Test"}
        result = map_subunit_from_api(data, "parent")
        assert result.naeringskode is None

    def test_handles_missing_antallAnsatte_defaults_to_zero(self):
        """antallAnsatte should default to 0 if missing."""
        data = {"organisasjonsnummer": "123", "navn": "Test"}
        result = map_subunit_from_api(data, "parent")
        assert result.antall_ansatte == 0

    def test_handles_missing_dates(self):
        """Should handle missing date fields gracefully."""
        data = {"organisasjonsnummer": "123", "navn": "Test"}
        result = map_subunit_from_api(data, "parent")
        assert result.stiftelsesdato is None
        assert result.registreringsdato_enhetsregisteret is None

    def test_handles_null_nested_objects(self):
        """Should handle None values for nested objects."""
        data = {
            "organisasjonsnummer": "123",
            "navn": "Test",
            "organisasjonsform": None,
            "naeringskode1": None,
        }
        result = map_subunit_from_api(data, "parent")
        assert result.organisasjonsform is None
        assert result.naeringskode is None

    def test_handles_minimal_api_response(self):
        """Should work with minimal required fields."""
        minimal_data = {
            "organisasjonsnummer": "999000111",
            "navn": "Minimal Subunit",
        }
        result = map_subunit_from_api(minimal_data, "parent_123")

        assert result.orgnr == "999000111"
        assert result.navn == "Minimal Subunit"
        assert result.parent_orgnr == "parent_123"
        assert result.organisasjonsform is None
        assert result.naeringskode is None
        assert result.antall_ansatte == 0
        assert result.beliggenhetsadresse is None
        assert result.postadresse is None
        assert result.stiftelsesdato is None
        assert result.registreringsdato_enhetsregisteret is None
        assert result.raw_data == minimal_data
