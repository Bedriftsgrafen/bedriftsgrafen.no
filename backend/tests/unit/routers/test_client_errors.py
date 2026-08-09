"""Tests for POST /v1/client-errors endpoint."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from limiter import limiter
from main import app
from utils.metrics import RATE_LIMIT_RESPONSES_TOTAL

client = TestClient(app)
limiter.enabled = False

VALID_PAYLOAD = {
    "message": "TypeError: Cannot read property 'foo' of undefined",
    "stack": "Error at Component.render (app.js:42)",
    "component_stack": "  in MyComponent\n  in App",
    "url": "https://bedriftsgrafen.no/virksomhet/123456789",
    "user_agent": "Mozilla/5.0 (X11; Linux x86_64)",
}


class TestClientErrorsEndpoint:
    def test_valid_payload_returns_204(self):
        with patch("routers.v1.client_errors.client_error_logger") as mock_logger:
            response = client.post("/v1/client-errors", json=VALID_PAYLOAD)
        assert response.status_code == 204
        mock_logger.error.assert_called_once()
        assert mock_logger.error.call_args.args[0] == "client_error %s"
        assert "client_message" in mock_logger.error.call_args.args[1]
        assert "client_url" in mock_logger.error.call_args.args[1]

    def test_minimal_payload_returns_204(self):
        """Only required fields: message and url."""
        with patch("routers.v1.client_errors.client_error_logger"):
            response = client.post("/v1/client-errors", json={"message": "oops", "url": "https://example.com"})
        assert response.status_code == 204

    def test_missing_required_field_returns_422(self):
        with patch("routers.v1.client_errors.client_error_logger"):
            response = client.post("/v1/client-errors", json={"message": "oops"})  # missing url
        assert response.status_code == 422

    def test_message_too_long_returns_422(self):
        with patch("routers.v1.client_errors.client_error_logger"):
            response = client.post(
                "/v1/client-errors",
                json={"message": "x" * 501, "url": "https://example.com"},
            )
        assert response.status_code == 422

    def test_stack_too_long_returns_422(self):
        with patch("routers.v1.client_errors.client_error_logger"):
            response = client.post(
                "/v1/client-errors",
                json={"message": "err", "url": "https://example.com", "stack": "x" * 5001},
            )
        assert response.status_code == 422

    def test_pii_token_is_redacted(self):
        """Bearer token in message should be redacted before logging."""
        logged_extra = {}

        def capture_extra(*args, extra=None, **kwargs):
            if extra:
                logged_extra.update(extra)

        with patch("routers.v1.client_errors.client_error_logger") as mock_logger:
            mock_logger.error.side_effect = capture_extra
            client.post(
                "/v1/client-errors",
                json={
                    "message": "Authorization: Bearer abc123secret",
                    "url": "https://example.com",
                },
            )

        assert "abc123secret" not in logged_extra.get("client_message", "")
        assert "[REDACTED]" in logged_extra.get("client_message", "")

    def test_fnr_is_redacted(self):
        """11-digit Norwegian fødselsnummer should be redacted."""
        logged_extra = {}

        def capture_extra(*args, extra=None, **kwargs):
            if extra:
                logged_extra.update(extra)

        with patch("routers.v1.client_errors.client_error_logger") as mock_logger:
            mock_logger.error.side_effect = capture_extra
            client.post(
                "/v1/client-errors",
                json={
                    "message": "User 12345678901 triggered error",
                    "url": "https://example.com",
                },
            )

        assert "12345678901" not in logged_extra.get("client_message", "")
        assert "[FNR-REDACTED]" in logged_extra.get("client_message", "")

    def test_email_is_redacted(self):
        """Email addresses in stack traces should be redacted."""
        logged_extra = {}

        def capture_extra(*args, extra=None, **kwargs):
            if extra:
                logged_extra.update(extra)

        with patch("routers.v1.client_errors.client_error_logger") as mock_logger:
            mock_logger.error.side_effect = capture_extra
            client.post(
                "/v1/client-errors",
                json={
                    "message": "Error for user test@example.com",
                    "url": "https://example.com",
                },
            )

        assert "test@example.com" not in logged_extra.get("client_message", "")
        assert "[EMAIL-REDACTED]" in logged_extra.get("client_message", "")

    @pytest.mark.parametrize("bad_input", ["not-json", b"\xff\xfe"])
    def test_invalid_body_returns_422(self, bad_input):
        with patch("routers.v1.client_errors.client_error_logger"):
            response = client.post(
                "/v1/client-errors",
                content=bad_input,
                headers={"Content-Type": "application/json"},
            )
        assert response.status_code == 422

    def test_rate_limit_returns_429_after_10_requests(self):
        """11th request within 60 s should be rate-limited (429)."""
        # Reset in-memory rate-limit counters so prior test runs don't pollute state
        try:
            limiter._storage.reset()  # type: ignore[attr-defined]
        except AttributeError:
            pass  # storage backend may not expose reset()

        limiter.enabled = True
        try:
            before = RATE_LIMIT_RESPONSES_TOTAL.labels(layer="backend")._value.get()
            with patch("routers.v1.client_errors.client_error_logger"):
                payload = {"message": "flood test", "url": "https://example.com"}
                responses = [client.post("/v1/client-errors", json=payload) for _ in range(11)]
            assert all(r.status_code == 204 for r in responses[:10])
            assert responses[-1].status_code == 429
            assert RATE_LIMIT_RESPONSES_TOTAL.labels(layer="backend")._value.get() == before + 1
        finally:
            limiter.enabled = False
