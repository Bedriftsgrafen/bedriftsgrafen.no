"""Unit tests for logging configuration helpers."""

import logging
from logging.handlers import RotatingFileHandler
from unittest.mock import patch

from utils import logging_config


def _reset_client_error_logger_state() -> None:
    """Ensure isolated logger state between tests."""
    client_logger = logging.getLogger("bedriftsgrafen.client_errors")
    for handler in client_logger.handlers[:]:
        client_logger.removeHandler(handler)
        handler.close()
    client_logger.propagate = True
    logging_config._client_error_logger_init_failed = False


def test_setup_client_error_logger_uses_env_path(monkeypatch, tmp_path):
    """Should respect CLIENT_ERRORS_LOG_PATH and configure handler successfully."""
    _reset_client_error_logger_state()
    log_path = tmp_path / "client_errors.log"
    monkeypatch.setenv("CLIENT_ERRORS_LOG_PATH", str(log_path))

    logging_config._setup_client_error_logger()

    client_logger = logging.getLogger("bedriftsgrafen.client_errors")
    assert client_logger.handlers
    assert any(isinstance(handler, RotatingFileHandler) for handler in client_logger.handlers)
    assert any(
        isinstance(handler, logging.StreamHandler) and not isinstance(handler, RotatingFileHandler)
        for handler in client_logger.handlers
    )
    assert client_logger.propagate is False


def test_setup_client_error_logger_logs_warning_only_once(monkeypatch, caplog):
    """Should warn once and stop retrying if file handler setup fails."""
    _reset_client_error_logger_state()
    monkeypatch.setenv("CLIENT_ERRORS_LOG_PATH", "/root/forbidden/client_errors.log")

    with patch("utils.logging_config.RotatingFileHandler", side_effect=OSError("permission denied")):
        with caplog.at_level("WARNING"):
            logging_config._setup_client_error_logger()
            logging_config._setup_client_error_logger()

    warnings = [rec for rec in caplog.records if "Could not create client_errors.log" in rec.message]
    client_logger = logging.getLogger("bedriftsgrafen.client_errors")
    assert len(warnings) == 1
    assert logging_config._client_error_logger_init_failed is True
    assert client_logger.handlers
    assert client_logger.propagate is False
