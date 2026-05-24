#!/usr/bin/env python3
"""Adtraction commission notifier CLI.

The notifier alerts on commission-bearing transactions and generated payments,
but intentionally ignores clicks and click-only statistics.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_API_BASE_URL = "https://api.adtraction.net/v2"
DEFAULT_API_KEY_FILE = "observability/secrets/ADTRACTION_API_KEY"
DEFAULT_DISCORD_WEBHOOK_FILE = "observability/secrets/ADTRACTION_DISCORD_WEB_HOOK"
DEFAULT_STATE_PATH = "observability/state/adtraction_notifier_state.json"
DEFAULT_ALERT_MODE = "commission_events"
DEFAULT_MAX_DISCORD_MESSAGES = 10


class NotifierError(RuntimeError):
    """Raised when the notifier cannot complete safely."""


@dataclass(frozen=True)
class AdtractionConfig:
    api_base_url: str
    api_key_file: Path
    discord_webhook_file: Path
    state_path: Path
    currency: str
    lookback_days: int
    timeout_seconds: float
    alert_mode: str
    max_discord_messages: int


@dataclass(frozen=True)
class ApiResult:
    data: Any
    rate_limit: dict[str, str | None]


def resolve_repo_path(path_value: str) -> Path:
    path = Path(path_value).expanduser()
    if path.is_absolute():
        return path
    return REPO_ROOT / path


def read_secret_file(path: Path, label: str) -> str:
    try:
        secret = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError as exc:
        raise NotifierError(f"Missing {label} file: {path}") from exc
    if not secret:
        raise NotifierError(f"Empty {label} file: {path}")
    return secret


def mask_identifier(value: Any) -> str | None:
    if value is None:
        return None
    identifier = str(value)
    if len(identifier) <= 4:
        return "*" * len(identifier)
    return f"***{identifier[-4:]}"


def parse_adtraction_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip()
    if len(normalized) >= 5 and normalized[-5] in {"+", "-"} and normalized[-3] != ":":
        normalized = f"{normalized[:-2]}:{normalized[-2:]}"
    if normalized.endswith("Z"):
        normalized = f"{normalized[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def decimal_or_zero(value: Any) -> Decimal:
    if value is None:
        return Decimal(0)
    try:
        return Decimal(str(value))
    except InvalidOperation, ValueError:
        return Decimal(0)


def parse_non_negative_int(value: Any, label: str) -> int:
    try:
        parsed_value = int(value)
    except (TypeError, ValueError) as exc:
        raise NotifierError(f"{label} must be a non-negative integer") from exc
    if parsed_value < 0:
        raise NotifierError(f"{label} must be a non-negative integer")
    return parsed_value


def decimal_to_json(value: Decimal) -> int | float:
    if value == value.to_integral_value():
        return int(value)
    return float(value)


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"seen_event_ids": [], "last_successful_poll_at": None}
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise NotifierError(f"Invalid state JSON: {path}") from exc
    if not isinstance(state, dict):
        raise NotifierError(f"Invalid state format: {path}")
    seen_event_ids = state.get("seen_event_ids", [])
    seen_payment_ids = state.get("seen_payment_ids", [])
    if not isinstance(seen_event_ids, list):
        raise NotifierError(f"Invalid seen_event_ids in state: {path}")
    if not isinstance(seen_payment_ids, list):
        raise NotifierError(f"Invalid seen_payment_ids in state: {path}")
    return state


def seen_event_ids_from_state(state: dict[str, Any]) -> set[str]:
    seen_event_ids = {str(value) for value in state.get("seen_event_ids", [])}
    legacy_payment_ids = {f"payment:{value}" for value in state.get("seen_payment_ids", [])}
    return seen_event_ids | legacy_payment_ids


def save_state(path: Path, event_ids: set[str], poll_time: datetime) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "seen_event_ids": sorted(event_ids),
        "last_successful_poll_at": poll_time.isoformat().replace("+00:00", "Z"),
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def payment_id(payment: dict[str, Any]) -> str | None:
    raw_payment_id = payment.get("paymentId")
    if raw_payment_id is None:
        return None
    return str(raw_payment_id)


def payment_event_id(payment: dict[str, Any]) -> str | None:
    current_payment_id = payment_id(payment)
    if current_payment_id is None:
        return None
    return f"payment:{current_payment_id}"


def payment_date(payment: dict[str, Any]) -> datetime | None:
    return parse_adtraction_datetime(payment.get("paymentdate") or payment.get("paymentDate"))


def transaction_date(transaction: dict[str, Any]) -> datetime | None:
    return parse_adtraction_datetime(transaction.get("transactionDate"))


def transaction_event_id(transaction: dict[str, Any]) -> str:
    raw_unique_id = transaction.get("uniqueId")
    if raw_unique_id:
        return f"transaction:{raw_unique_id}"

    raw_click = transaction.get("click")
    click: dict[str, Any] = raw_click if isinstance(raw_click, dict) else {}
    digest_source = {
        "commission": transaction.get("commission"),
        "currency": transaction.get("currency"),
        "lastUpdated": transaction.get("lastUpdated"),
        "programId": click.get("programId"),
        "transactionDate": transaction.get("transactionDate"),
        "transactionName": transaction.get("transactionName"),
        "transactionType": transaction.get("transactionType"),
    }
    digest = hashlib.sha256(json.dumps(digest_source, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return f"transaction:digest:{digest}"


def filter_payments_by_window(
    payments: list[dict[str, Any]], lookback_days: int, now: datetime
) -> list[dict[str, Any]]:
    if lookback_days <= 0:
        return payments
    cutoff = now - timedelta(days=lookback_days)
    filtered_payments = []
    for payment in payments:
        parsed_date = payment_date(payment)
        if parsed_date is None or parsed_date >= cutoff:
            filtered_payments.append(payment)
    return filtered_payments


def filter_transactions_by_window(
    transactions: list[dict[str, Any]], lookback_days: int, now: datetime
) -> list[dict[str, Any]]:
    if lookback_days <= 0:
        return transactions
    cutoff = now - timedelta(days=lookback_days)
    filtered_transactions = []
    for transaction in transactions:
        parsed_date = transaction_date(transaction)
        if parsed_date is None or parsed_date >= cutoff:
            filtered_transactions.append(transaction)
    return filtered_transactions


def rate_limit_headers(response: httpx.Response) -> dict[str, str | None]:
    return {
        "limit": response.headers.get("X-RateLimit-Limit"),
        "remaining": response.headers.get("X-RateLimit-Remaining"),
        "reset": response.headers.get("X-RateLimit-Reset"),
    }


def retry_after_seconds(response: httpx.Response, now: datetime) -> int | None:
    retry_after = response.headers.get("Retry-After")
    if retry_after and retry_after.isdigit():
        return int(retry_after)
    reset_header = response.headers.get("X-RateLimit-Reset")
    if not reset_header or not reset_header.isdigit():
        return None
    reset_value = int(reset_header)
    if reset_value > 9_999_999_999:
        reset_value = reset_value // 1000
    return max(0, int(reset_value - now.timestamp()))


async def get_json(client: httpx.AsyncClient, path: str, api_key: str, now: datetime) -> ApiResult:
    response = await client.get(
        path,
        headers={"X-Token": api_key, "Accept": "application/json", "Content-Type": "application/json"},
    )
    return parse_response(response, now)


async def post_json(
    client: httpx.AsyncClient, path: str, api_key: str, now: datetime, payload: dict[str, Any]
) -> ApiResult:
    response = await client.post(
        path,
        headers={"X-Token": api_key, "Accept": "application/json", "Content-Type": "application/json"},
        json=payload,
    )
    return parse_response(response, now)


def parse_response(response: httpx.Response, now: datetime) -> ApiResult:
    if response.status_code == 429:
        retry_seconds = retry_after_seconds(response, now)
        retry_text = f" retry_after_seconds={retry_seconds}" if retry_seconds is not None else ""
        raise NotifierError(f"Adtraction rate limit hit.{retry_text}")
    if response.status_code in {401, 403}:
        raise NotifierError(f"Adtraction authentication failed with status {response.status_code}")
    if response.status_code >= 400:
        raise NotifierError(f"Adtraction request failed with status {response.status_code}")
    try:
        data = response.json()
    except ValueError as exc:
        raise NotifierError("Adtraction returned non-JSON response") from exc
    if isinstance(data, dict) and isinstance(data.get("status"), int) and data["status"] >= 400:
        raise NotifierError(f"Adtraction returned status {data['status']}: {data.get('message', 'unknown error')}")
    return ApiResult(data=data, rate_limit=rate_limit_headers(response))


async def fetch_payments(client: httpx.AsyncClient, config: AdtractionConfig, api_key: str, now: datetime) -> ApiResult:
    return await get_json(client, f"/partner/payments/{config.currency}/", api_key, now)


async def fetch_balance(client: httpx.AsyncClient, config: AdtractionConfig, api_key: str, now: datetime) -> ApiResult:
    return await get_json(client, f"/partner/balance/{config.currency}/", api_key, now)


async def fetch_transactions(
    client: httpx.AsyncClient, config: AdtractionConfig, api_key: str, now: datetime
) -> ApiResult:
    from_date = now - timedelta(days=config.lookback_days)
    payload = {
        "fromDate": format_adtraction_datetime(from_date),
        "toDate": format_adtraction_datetime(now),
        "transactionStatus": 3,
        "currency": config.currency,
    }
    return await post_json(client, "/partner/transactions/", api_key, now, payload)


def format_adtraction_datetime(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S+0000")


def normalize_payment_list(data: Any) -> list[dict[str, Any]]:
    if not isinstance(data, list):
        if isinstance(data, dict) and data.get("status") == 200 and data.get("message") == "No payments found.":
            return []
        raise NotifierError("Unexpected Adtraction payments response; expected a list")
    payments = []
    for item in data:
        if isinstance(item, dict):
            payments.append(item)
    return payments


def normalize_transaction_list(data: Any) -> list[dict[str, Any]]:
    if not isinstance(data, list):
        if isinstance(data, dict) and data.get("status") == 200 and "No transactions" in str(data.get("message", "")):
            return []
        raise NotifierError("Unexpected Adtraction transactions response; expected a list")
    transactions = []
    for item in data:
        if isinstance(item, dict) and decimal_or_zero(item.get("commission")) > 0:
            transactions.append(item)
    return transactions


def sanitize_balance(balance_context: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(balance_context, dict):
        return None
    allowed_keys = ["pendingBalance", "confirmedBalance", "invoicedBalance", "payableBalance", "totalBalance"]
    return {key: balance_context.get(key) for key in allowed_keys if key in balance_context}


def current_event_ids_from_results(payments: list[dict[str, Any]], transactions: list[dict[str, Any]]) -> set[str]:
    payment_event_ids = {current_id for payment in payments if (current_id := payment_event_id(payment))}
    transaction_event_ids = {transaction_event_id(transaction) for transaction in transactions}
    return payment_event_ids | transaction_event_ids


def build_event_summary(
    payments: list[dict[str, Any]],
    transactions: list[dict[str, Any]],
    seen_event_ids: set[str],
    balance_context: dict[str, Any] | None,
    rate_limit: dict[str, str | None],
    config: AdtractionConfig,
    now: datetime,
) -> dict[str, Any]:
    payments_by_currency: dict[str, int] = defaultdict(int)
    transactions_by_status: dict[str, int] = defaultdict(int)
    transactions_by_type: dict[str, int] = defaultdict(int)
    total_payment_amount = Decimal(0)
    total_commission_amount = Decimal(0)
    latest_payment = None
    latest_transaction = None
    new_candidates = []

    for payment in payments:
        current_payment_id = payment_id(payment)
        current_event_id = payment_event_id(payment)
        current_payment_date = payment_date(payment)
        current_currency = str(payment.get("currency") or config.currency)
        current_total = decimal_or_zero(payment.get("totalAmount"))

        payments_by_currency[current_currency] += 1
        total_payment_amount += current_total
        if current_payment_date and (latest_payment is None or current_payment_date > latest_payment):
            latest_payment = current_payment_date

        if current_payment_id and current_event_id and current_event_id not in seen_event_ids:
            new_candidates.append(
                {
                    "event_type": "payment",
                    "payment_id": mask_identifier(current_payment_id),
                    "event_date": format_json_datetime(current_payment_date),
                    "payment_date": format_json_datetime(current_payment_date),
                    "currency": current_currency,
                    "total_amount": decimal_to_json(current_total),
                    "original_currency": payment.get("originalCurrency"),
                    "exchange_rate": payment.get("exchangeRate"),
                }
            )

    for transaction in transactions:
        current_event_id = transaction_event_id(transaction)
        current_transaction_date = transaction_date(transaction)
        current_currency = str(transaction.get("currency") or config.currency)
        current_commission = decimal_or_zero(transaction.get("commission"))
        current_status = str(transaction.get("transactionStatus") or "unknown")
        current_type = str(transaction.get("transactionName") or transaction.get("transactionType") or "unknown")
        raw_click = transaction.get("click")
        click: dict[str, Any] = raw_click if isinstance(raw_click, dict) else {}

        transactions_by_status[current_status] += 1
        transactions_by_type[current_type] += 1
        total_commission_amount += current_commission
        if current_transaction_date and (latest_transaction is None or current_transaction_date > latest_transaction):
            latest_transaction = current_transaction_date

        if current_event_id not in seen_event_ids:
            new_candidates.append(
                {
                    "event_type": "commission_transaction",
                    "transaction_id": mask_identifier(current_event_id),
                    "event_date": format_json_datetime(current_transaction_date),
                    "transaction_date": format_json_datetime(current_transaction_date),
                    "currency": current_currency,
                    "commission": decimal_to_json(current_commission),
                    "program_name": click.get("programName"),
                    "transaction_name": transaction.get("transactionName"),
                    "transaction_status": transaction.get("transactionStatus"),
                    "payment_status": transaction.get("paymentStatus"),
                    "auto_approval_date": transaction.get("autoApprovalDate"),
                }
            )

    return {
        "alert_mode": config.alert_mode,
        "currency": config.currency,
        "window_days": config.lookback_days,
        "events_seen": len(payments) + len(transactions),
        "payments_seen": len(payments),
        "commission_transactions_seen": len(transactions),
        "new_event_candidates": sorted(new_candidates, key=lambda candidate: candidate.get("event_date") or ""),
        "payments_by_currency": dict(sorted(payments_by_currency.items())),
        "transactions_by_status": dict(sorted(transactions_by_status.items())),
        "transactions_by_type": dict(sorted(transactions_by_type.items())),
        "total_payment_amount": decimal_to_json(total_payment_amount),
        "total_commission_amount": decimal_to_json(total_commission_amount),
        "latest_payment_date": format_json_datetime(latest_payment),
        "latest_transaction_date": format_json_datetime(latest_transaction),
        "balance_context": sanitize_balance(balance_context),
        "rate_limit_remaining": rate_limit.get("remaining"),
        "rate_limit_reset": rate_limit.get("reset"),
        "last_successful_poll_at": format_json_datetime(now),
    }


def format_json_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")


def build_discord_payload(candidate: dict[str, Any]) -> dict[str, Any]:
    if candidate.get("event_type") == "commission_transaction":
        fields = [
            {"name": "Provisjon", "value": f"{candidate['commission']} {candidate['currency']}", "inline": True},
            {"name": "Dato", "value": candidate.get("transaction_date") or "Ukjent", "inline": True},
            {"name": "Status", "value": str(candidate.get("transaction_status") or "Ukjent"), "inline": True},
        ]
        if candidate.get("program_name"):
            fields.append({"name": "Program", "value": str(candidate["program_name"]), "inline": True})
        if candidate.get("transaction_name"):
            fields.append({"name": "Type", "value": str(candidate["transaction_name"]), "inline": True})
        if candidate.get("auto_approval_date"):
            fields.append({"name": "Auto-godkjenning", "value": str(candidate["auto_approval_date"]), "inline": True})
        return {
            "embeds": [
                {
                    "title": "Adtraction-provisjon registrert",
                    "description": "Bedriftsgrafen har fått en ny provisjonsgivende Adtraction-hendelse.",
                    "color": 0x1565C0,
                    "fields": fields,
                }
            ]
        }

    fields = [
        {"name": "Belop", "value": f"{candidate['total_amount']} {candidate['currency']}", "inline": True},
        {"name": "Betalingsdato", "value": candidate.get("payment_date") or "Ukjent", "inline": True},
        {"name": "Payment ID", "value": candidate.get("payment_id") or "Ukjent", "inline": True},
    ]
    if candidate.get("original_currency"):
        fields.append({"name": "Original valuta", "value": str(candidate["original_currency"]), "inline": True})
    if candidate.get("exchange_rate"):
        fields.append({"name": "Kurs", "value": str(candidate["exchange_rate"]), "inline": True})
    return {
        "embeds": [
            {
                "title": "Adtraction-utbetaling registrert",
                "description": "Bedriftsgrafen har fått en ny faktisk Adtraction-betaling.",
                "color": 0x2E7D32,
                "fields": fields,
            }
        ]
    }


async def send_discord_notifications(
    client: httpx.AsyncClient, webhook_url: str, candidates: list[dict[str, Any]]
) -> None:
    for candidate in candidates:
        response = await client.post(webhook_url, json=build_discord_payload(candidate))
        if response.status_code >= 400:
            raise NotifierError(f"Discord webhook failed with status {response.status_code}")


def build_config(args: argparse.Namespace) -> AdtractionConfig:
    currency = (args.currency or os.getenv("ADTRACTION_CURRENCY") or "NOK").upper()
    lookback_days_value = (
        args.lookback_days if args.lookback_days is not None else os.getenv("ADTRACTION_LOOKBACK_DAYS", "365")
    )
    lookback_days = parse_non_negative_int(lookback_days_value, "ADTRACTION_LOOKBACK_DAYS")
    alert_mode = args.alert_mode or os.getenv("ADTRACTION_ALERT_MODE") or DEFAULT_ALERT_MODE
    max_messages_value = (
        args.max_discord_messages
        if args.max_discord_messages is not None
        else os.getenv("ADTRACTION_MAX_DISCORD_MESSAGES", str(DEFAULT_MAX_DISCORD_MESSAGES))
    )
    max_discord_messages = parse_non_negative_int(max_messages_value, "ADTRACTION_MAX_DISCORD_MESSAGES")
    return AdtractionConfig(
        api_base_url=(args.api_base_url or os.getenv("ADTRACTION_API_BASE_URL") or DEFAULT_API_BASE_URL).rstrip("/"),
        api_key_file=resolve_repo_path(
            args.api_key_file or os.getenv("ADTRACTION_API_KEY_FILE") or DEFAULT_API_KEY_FILE
        ),
        discord_webhook_file=resolve_repo_path(
            args.discord_webhook_file or os.getenv("ADTRACTION_DISCORD_WEBHOOK_FILE") or DEFAULT_DISCORD_WEBHOOK_FILE
        ),
        state_path=resolve_repo_path(args.state_path or os.getenv("ADTRACTION_STATE_PATH") or DEFAULT_STATE_PATH),
        currency=currency,
        lookback_days=lookback_days,
        timeout_seconds=args.timeout_seconds,
        alert_mode=alert_mode,
        max_discord_messages=max_discord_messages,
    )


async def run(args: argparse.Namespace) -> int:
    if args.dry_run and (args.mark_seen or args.send_discord):
        raise NotifierError("Use --dry-run by itself; it cannot be combined with --mark-seen or --send-discord")
    if args.mark_seen and args.send_discord:
        raise NotifierError("Use either --mark-seen or --send-discord, not both")

    now = datetime.now(UTC)
    config = build_config(args)
    api_key = read_secret_file(config.api_key_file, "Adtraction API key")
    state = load_state(config.state_path)
    seen_event_ids = seen_event_ids_from_state(state)

    async with httpx.AsyncClient(base_url=config.api_base_url, timeout=config.timeout_seconds) as client:
        payments_result = await fetch_payments(client, config, api_key, now)
        transactions_result = await fetch_transactions(client, config, api_key, now)
        balance_result = await fetch_balance(client, config, api_key, now) if args.include_balance else None

        payments = normalize_payment_list(payments_result.data)
        transactions = normalize_transaction_list(transactions_result.data)
        scoped_payments = filter_payments_by_window(payments, config.lookback_days, now)
        scoped_transactions = filter_transactions_by_window(transactions, config.lookback_days, now)
        balance_context = balance_result.data if balance_result else None
        summary = build_event_summary(
            scoped_payments,
            scoped_transactions,
            seen_event_ids,
            balance_context,
            transactions_result.rate_limit,
            config,
            now,
        )

        if args.mark_seen:
            current_event_ids = current_event_ids_from_results(scoped_payments, scoped_transactions)
            save_state(config.state_path, seen_event_ids | current_event_ids, now)
            summary["marked_seen_count"] = len(current_event_ids)

        if args.send_discord:
            webhook_url = read_secret_file(config.discord_webhook_file, "Adtraction Discord webhook")
            candidates = summary["new_event_candidates"]
            if len(candidates) > config.max_discord_messages:
                raise NotifierError(
                    f"Refusing to send {len(candidates)} Discord messages; "
                    f"max is {config.max_discord_messages}. Run --mark-seen first or raise the limit explicitly."
                )
            await send_discord_notifications(client, webhook_url, candidates)
            current_event_ids = current_event_ids_from_results(scoped_payments, scoped_transactions)
            save_state(config.state_path, seen_event_ids | current_event_ids, now)
            summary["discord_messages_sent"] = len(candidates)
        else:
            summary["discord_messages_sent"] = 0

    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Adtraction commission notifier for Bedriftsgrafen.")
    parser.add_argument(
        "--dry-run", action="store_true", help="Fetch and summarize Adtraction events without sending Discord"
    )
    parser.add_argument(
        "--mark-seen", action="store_true", help="Mark fetched Adtraction events as seen without sending Discord"
    )
    parser.add_argument(
        "--send-discord", action="store_true", help="Send Discord alerts for unseen commission events and payments"
    )
    parser.add_argument("--include-balance", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--currency", help="ISO 4217 currency to query, defaults to ADTRACTION_CURRENCY or NOK")
    parser.add_argument("--lookback-days", type=int, help="Only include events within this many days")
    parser.add_argument("--alert-mode", choices=["commission_events"], help="Alert mode; clicks are never included")
    parser.add_argument(
        "--max-discord-messages",
        type=int,
        help="Maximum Discord messages to send in one run, defaults to ADTRACTION_MAX_DISCORD_MESSAGES or 10",
    )
    parser.add_argument("--api-base-url", help="Override Adtraction API base URL")
    parser.add_argument("--api-key-file", help="Path to file containing the Adtraction API key")
    parser.add_argument("--discord-webhook-file", help="Path to file containing the Adtraction Discord webhook")
    parser.add_argument("--state-path", help="Path to notifier state JSON")
    parser.add_argument("--timeout-seconds", type=float, default=20.0)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        return asyncio.run(run(args))
    except NotifierError as exc:
        print(
            json.dumps({"error": str(exc), "alert_mode": DEFAULT_ALERT_MODE}, indent=2, sort_keys=True),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
