"""
Unit tests for SsbService.

Tests SSB API fetching, JSON-STAT2 parsing, and database upserting.
Follows AAA pattern (Arrange - Act - Assert).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.ssb_service import SsbService, MUNICIPALITY_CODE_PATTERN


class TestSsbServiceInit:
    """Tests for SsbService initialization."""

    def test_init_sets_db(self):
        # Arrange
        mock_db = MagicMock()

        # Act
        service = SsbService(mock_db)

        # Assert
        assert service.db == mock_db


class TestMunicipalityCodePattern:
    """Tests for municipality code validation."""

    def test_valid_4_digit_codes(self):
        assert MUNICIPALITY_CODE_PATTERN.match("0301")  # Oslo
        assert MUNICIPALITY_CODE_PATTERN.match("1103")  # Stavanger
        assert MUNICIPALITY_CODE_PATTERN.match("5001")  # Trondheim

    def test_invalid_codes_rejected(self):
        assert not MUNICIPALITY_CODE_PATTERN.match("301")  # Too short
        assert not MUNICIPALITY_CODE_PATTERN.match("03011")  # Too long
        assert not MUNICIPALITY_CODE_PATTERN.match("K0301")  # Has letter
        assert not MUNICIPALITY_CODE_PATTERN.match("")  # Empty


class TestParseJsonStat2:
    """Tests for JSON-STAT2 response parsing."""

    def test_parse_valid_response(self):
        # Arrange
        mock_db = MagicMock()
        service = SsbService(mock_db)

        mock_data = {
            "dimension": {
                "Region": {
                    "category": {
                        "index": {"K0301": 0, "K1103": 1}
                    }
                },
                "Tid": {
                    "category": {
                        "index": {"2024": 0}
                    }
                }
            },
            "value": [700000, 145000]
        }

        # Act
        result = service._parse_json_stat2(mock_data)

        # Assert
        assert result is not None
        year, population = result
        assert year == 2024
        assert population["0301"] == 700000
        assert population["1103"] == 145000

    def test_parse_filters_invalid_codes(self):
        # Arrange
        mock_db = MagicMock()
        service = SsbService(mock_db)

        mock_data = {
            "dimension": {
                "Region": {
                    "category": {
                        "index": {
                            "K0301": 0,  # Valid
                            "Hele landet": 1,  # Invalid
                            "03": 2,  # Invalid (too short after K removal)
                        }
                    }
                },
                "Tid": {"category": {"index": {"2024": 0}}}
            },
            "value": [700000, 5000000, 300000]
        }

        # Act
        result = service._parse_json_stat2(mock_data)

        # Assert
        assert result is not None
        year, population = result
        assert len(population) == 1  # Only valid code
        assert "0301" in population

    def test_parse_returns_none_for_empty_values(self):
        # Arrange
        mock_db = MagicMock()
        service = SsbService(mock_db)

        mock_data = {
            "dimension": {
                "Region": {"category": {"index": {"K0301": 0}}},
                "Tid": {"category": {"index": {"2024": 0}}}
            },
            "value": []  # Empty
        }

        # Act
        result = service._parse_json_stat2(mock_data)

        # Assert
        assert result is None

    def test_parse_returns_none_for_no_year(self):
        # Arrange
        mock_db = MagicMock()
        service = SsbService(mock_db)

        mock_data = {
            "dimension": {
                "Region": {"category": {"index": {"K0301": 0}}},
                "Tid": {"category": {"index": {}}}  # No year
            },
            "value": [700000]
        }

        # Act
        result = service._parse_json_stat2(mock_data)

        # Assert
        assert result is None


class TestUpsertPopulation:
    """Tests for database upsert logic."""

    @pytest.mark.asyncio
    async def test_upsert_empty_data_returns_zero(self):
        # Arrange
        mock_db = MagicMock()
        service = SsbService(mock_db)

        # Act
        result = await service._upsert_population(2024, {})

        # Assert
        assert result == 0

    @pytest.mark.asyncio
    async def test_upsert_returns_row_count(self):
        # Arrange
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        service = SsbService(mock_db)

        population_data = {
            "0301": 700000,
            "1103": 145000,
            "5001": 210000,
        }

        # Act
        result = await service._upsert_population(2024, population_data)

        # Assert
        assert result == 3
        assert mock_db.execute.called
        assert mock_db.commit.called


class TestFetchAndStorePopulation:
    """Tests for the main fetch and store workflow."""

    @pytest.mark.asyncio
    async def test_fetch_success_returns_summary(self):
        # Arrange
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        service = SsbService(mock_db)

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "dimension": {
                "Region": {"category": {"index": {"K0301": 0}}},
                "Tid": {"category": {"index": {"2024": 0}}}
            },
            "value": [700000]
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            # Act
            result = await service.fetch_and_store_population()

        # Assert
        assert result["status"] == "success"
        assert result["year"] == 2024
        assert result["municipality_count"] == 1

    @pytest.mark.asyncio
    async def test_fetch_timeout_raises_runtime_error(self):
        # Arrange
        mock_db = MagicMock()
        service = SsbService(mock_db)

        import httpx
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                side_effect=httpx.TimeoutException("Timeout")
            )

            # Act & Assert
            with pytest.raises(RuntimeError) as exc_info:
                await service.fetch_and_store_population()

            assert "timed out" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_fetch_http_error_raises_runtime_error(self):
        # Arrange
        mock_db = MagicMock()
        service = SsbService(mock_db)

        import httpx
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "Server Error", request=MagicMock(), response=mock_response
        )

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )

            # Act & Assert
            with pytest.raises(RuntimeError) as exc_info:
                await service.fetch_and_store_population()

            assert "500" in str(exc_info.value)
