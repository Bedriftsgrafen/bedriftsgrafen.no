from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[4]


def _step(job: dict, name: str) -> dict:
    return next(step for step in job["steps"] if step.get("name") == name)


def test_security_workflow_enforces_dependency_and_sast_findings() -> None:
    workflow = yaml.safe_load((REPO_ROOT / ".github/workflows/security.yml").read_text(encoding="utf-8"))

    frontend_audit = _step(workflow["jobs"]["frontend-security"], "npm audit (workspace)")["run"].splitlines()
    backend_audit = _step(workflow["jobs"]["backend-security"], "pip-audit")["run"].splitlines()
    bandit = _step(workflow["jobs"]["backend-security"], "Bandit SAST")["run"].splitlines()

    assert frontend_audit[-1] == "npm audit --audit-level=moderate"
    assert backend_audit[-1] == "pip-audit"
    assert bandit[-1] == "bandit -r . -lll"


def test_security_workflow_scans_full_history_with_pinned_gitleaks_image() -> None:
    workflow = yaml.safe_load((REPO_ROOT / ".github/workflows/security.yml").read_text(encoding="utf-8"))
    job = workflow["jobs"]["secret-scanning"]

    assert _step(job, "Checkout full history")["with"]["fetch-depth"] == 0

    command = _step(job, "Run Gitleaks")["run"]
    assert "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:" in command
    assert "git --gitleaks-ignore-path /repo/.gitleaksignore --no-banner --redact --verbose /repo" in command
    assert "secret-scanning" in workflow["jobs"]["security-summary"]["needs"]


def test_local_security_audit_uses_current_blocking_scanner_commands() -> None:
    script = (REPO_ROOT / "scripts/security-audit.sh").read_text(encoding="utf-8")

    assert "gitleaks git --gitleaks-ignore-path .gitleaksignore --no-banner --redact --verbose ." in script
    assert '"$GITLEAKS_IMAGE"' in script
    assert "git --gitleaks-ignore-path /repo/.gitleaksignore --no-banner --redact --verbose /repo" in script
    assert "gitleaks detect" not in script
    assert "bandit -r . -x ./.venv -lll -q" in script
    assert "trivy image --exit-code 1 --ignore-unfixed --severity CRITICAL,HIGH" in script
    assert script.rstrip().endswith('exit "$OVERALL_STATUS"')
