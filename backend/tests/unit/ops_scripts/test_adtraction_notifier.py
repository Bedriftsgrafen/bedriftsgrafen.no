from datetime import UTC, datetime
from decimal import Decimal

from scripts import adtraction_notifier as notifier


def test_mask_identifier_masks_all_but_last_four_characters():
    assert notifier.mask_identifier("123456789") == "***6789"
    assert notifier.mask_identifier("123") == "***"
    assert notifier.mask_identifier(None) is None


def test_parse_adtraction_datetime_handles_compact_timezone():
    parsed = notifier.parse_adtraction_datetime("2018-01-31T23:59:59+0100")

    assert parsed == datetime(2018, 1, 31, 22, 59, 59, tzinfo=UTC)


def test_filter_payments_by_window_keeps_recent_and_unknown_dates():
    now = datetime(2026, 5, 24, tzinfo=UTC)
    payments = [
        {"paymentId": 1, "paymentdate": "2026-05-20T12:00:00+0200"},
        {"paymentId": 2, "paymentdate": "2024-05-20T12:00:00+0200"},
        {"paymentId": 3},
    ]

    filtered = notifier.filter_payments_by_window(payments, lookback_days=365, now=now)

    assert [payment["paymentId"] for payment in filtered] == [1, 3]


def test_build_event_summary_includes_commission_transactions_and_masks_candidates(tmp_path):
    config = notifier.AdtractionConfig(
        api_base_url="https://api.adtraction.net/v2",
        api_key_file=tmp_path / "api_key",
        discord_webhook_file=tmp_path / "webhook",
        state_path=tmp_path / "state.json",
        currency="NOK",
        lookback_days=365,
        timeout_seconds=20.0,
        alert_mode="commission_events",
        max_discord_messages=10,
    )
    payments = [
        {
            "paymentId": 1047411868,
            "currency": "NOK",
            "totalAmount": 130,
            "paymentdate": "2026-05-20T12:00:00+0200",
        },
        {
            "paymentId": 1047411869,
            "currency": "NOK",
            "totalAmount": "70.5",
            "paymentdate": "2026-05-21T12:00:00+0200",
        },
    ]
    transactions = [
        {
            "uniqueId": "25862d1e-dc51-4fb2-82ae-24b8533ef417",
            "commission": 130,
            "currency": "NOK",
            "transactionDate": "2026-05-22T12:00:00+0200",
            "transactionName": "Lead",
            "transactionStatus": 2,
            "paymentStatus": 1,
            "autoApprovalDate": "2026-08-22",
            "click": {"programId": 42, "programName": "Tjenestetorget"},
        }
    ]

    summary = notifier.build_event_summary(
        payments=payments,
        transactions=transactions,
        seen_event_ids={"payment:1047411868"},
        balance_context={"payableBalance": 0, "totalBalance": 200, "ignored": "nope"},
        rate_limit={"remaining": "29", "reset": "1565602012124", "limit": "30"},
        config=config,
        now=datetime(2026, 5, 24, tzinfo=UTC),
    )

    assert summary["alert_mode"] == "commission_events"
    assert summary["events_seen"] == 3
    assert summary["payments_seen"] == 2
    assert summary["commission_transactions_seen"] == 1
    assert summary["payments_by_currency"] == {"NOK": 2}
    assert summary["total_payment_amount"] == 200.5
    assert summary["total_commission_amount"] == 130
    assert summary["latest_payment_date"] == "2026-05-21T10:00:00Z"
    assert summary["latest_transaction_date"] == "2026-05-22T10:00:00Z"
    assert summary["transactions_by_status"] == {"2": 1}
    assert summary["transactions_by_type"] == {"Lead": 1}
    assert summary["new_event_candidates"] == [
        {
            "event_type": "payment",
            "payment_id": "***1869",
            "event_date": "2026-05-21T10:00:00Z",
            "payment_date": "2026-05-21T10:00:00Z",
            "currency": "NOK",
            "total_amount": 70.5,
            "original_currency": None,
            "exchange_rate": None,
        },
        {
            "event_type": "commission_transaction",
            "transaction_id": "***f417",
            "event_date": "2026-05-22T10:00:00Z",
            "transaction_date": "2026-05-22T10:00:00Z",
            "currency": "NOK",
            "commission": 130,
            "program_name": "Tjenestetorget",
            "transaction_name": "Lead",
            "transaction_status": 2,
            "payment_status": 1,
            "auto_approval_date": "2026-08-22",
        },
    ]
    assert summary["balance_context"] == {"payableBalance": 0, "totalBalance": 200}
    assert summary["rate_limit_remaining"] == "29"


def test_normalize_payment_list_accepts_no_payments_message():
    assert notifier.normalize_payment_list({"status": 200, "message": "No payments found."}) == []


def test_normalize_transaction_list_filters_click_only_or_zero_commission_items():
    transactions = notifier.normalize_transaction_list(
        [
            {"uniqueId": "lead-1", "commission": 130, "transactionName": "Lead"},
            {"uniqueId": "click-1", "commission": 0, "transactionName": "Click"},
            {"uniqueId": "missing-commission"},
        ]
    )

    assert transactions == [{"uniqueId": "lead-1", "commission": 130, "transactionName": "Lead"}]


def test_current_event_ids_from_results_includes_payments_and_transactions():
    event_ids = notifier.current_event_ids_from_results(
        payments=[{"paymentId": 1047411868}],
        transactions=[{"uniqueId": "25862d1e-dc51-4fb2-82ae-24b8533ef417"}],
    )

    assert event_ids == {"payment:1047411868", "transaction:25862d1e-dc51-4fb2-82ae-24b8533ef417"}


def test_decimal_to_json_preserves_integer_shape():
    assert notifier.decimal_to_json(Decimal(130)) == 130
    assert notifier.decimal_to_json(Decimal("130.25")) == 130.25


def test_decimal_or_zero_handles_invalid_values():
    assert notifier.decimal_or_zero("not-a-number") == Decimal(0)


def test_build_config_preserves_zero_lookback_days(monkeypatch):
    monkeypatch.delenv("ADTRACTION_LOOKBACK_DAYS", raising=False)
    args = notifier.parse_args(["--dry-run", "--lookback-days", "0", "--max-discord-messages", "0"])

    config = notifier.build_config(args)

    assert config.lookback_days == 0
    assert config.max_discord_messages == 0


def test_retry_after_seconds_accepts_milliseconds_header():
    class Response:
        headers = {"X-RateLimit-Reset": "1770000000000"}

    now = datetime.fromtimestamp(1769999990, tz=UTC)

    assert notifier.retry_after_seconds(Response(), now) == 10
