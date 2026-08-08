import json
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[4]
OBSERVABILITY_ROOT = REPO_ROOT / "observability"


def _load_yaml(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def test_brreg_dashboard_contains_required_low_cardinality_panels():
    dashboard_path = OBSERVABILITY_ROOT / "grafana" / "dashboards" / "bedriftsgrafen-brreg-egress.json"
    dashboard = json.loads(dashboard_path.read_text(encoding="utf-8"))

    assert dashboard["uid"] == "bedriftsgrafen-brreg-egress"
    titles = {panel["title"] for panel in dashboard["panels"]}
    assert {
        "Requests, Logical Operations, Upstream Attempts",
        "Amplification Ratios",
        "Egress Cap Utilization",
        "Brreg HTTP Attempts by Endpoint and Outcome",
        "Guard Decisions",
        "Guard Wait P95",
        "Cache Outcomes",
        "Brreg/Guard Incidents",
        "Backend/Worker Health and 429",
        "Nginx 429 / Limit Logs",
    }.issubset(titles)

    expressions = json.dumps(dashboard)
    assert "organisasjonsnummer" not in expressions
    assert "orgnr" not in expressions
    assert "X-Forwarded-For" not in expressions

    target_expressions = [
        target["expr"] for panel in dashboard["panels"] for target in panel.get("targets", []) if "expr" in target
    ]
    assert any('bedriftsgrafen_brreg_egress_config{setting="enabled"}' in expr for expr in target_expressions)
    assert any(
        'changes(container_start_time_seconds{name=~"bedriftsgrafen-(backend|worker)"}[10m])' in expr
        for expr in target_expressions
    )


def test_brreg_alerts_are_provisioned_and_baseline_dependent_rules_are_paused():
    alert_path = OBSERVABILITY_ROOT / "grafana" / "provisioning" / "alerting" / "brreg-egress-alerts.yml"
    config = _load_yaml(alert_path)
    rules = config["groups"][0]["rules"]
    by_uid = {rule["uid"]: rule for rule in rules}

    required_active = {
        "bedriftsgrafen_brreg_egress_at_configured_cap",
        "bedriftsgrafen_brreg_egress_waited",
        "bedriftsgrafen_brreg_guard_rejections",
        "bedriftsgrafen_brreg_429_detected",
        "bedriftsgrafen_brreg_timeouts_detected",
        "bedriftsgrafen_brreg_circuit_open",
        "bedriftsgrafen_brreg_guard_redis_errors",
        "bedriftsgrafen_backend_429_seen",
        "bedriftsgrafen_api_scrape_failure",
        "bedriftsgrafen_backend_worker_restart",
    }
    assert required_active.issubset(by_uid)
    assert all(by_uid[uid]["isPaused"] is False for uid in required_active)

    assert by_uid["bedriftsgrafen_request_amplification_shift_provisional"]["isPaused"] is True
    assert by_uid["bedriftsgrafen_cache_outcome_shift_provisional"]["isPaused"] is True


def test_brreg_alerts_use_existing_discord_notification_path():
    contact_points = _load_yaml(
        OBSERVABILITY_ROOT / "grafana" / "provisioning" / "alerting" / "discord-contact-point.yml"
    )
    policies = _load_yaml(OBSERVABILITY_ROOT / "grafana" / "provisioning" / "alerting" / "notification-policies.yml")

    receiver_names = {contact["name"] for contact in contact_points["contactPoints"]}
    assert "bedriftsgrafen-discord" in receiver_names

    root_policy = policies["policies"][0]
    assert root_policy["receiver"] == "bedriftsgrafen-discord"
    routed_severities = {
        matcher[2]
        for route in root_policy["routes"]
        for matcher in route["object_matchers"]
        if matcher[0] == "severity"
    }
    assert {"critical", "warning"}.issubset(routed_severities)
