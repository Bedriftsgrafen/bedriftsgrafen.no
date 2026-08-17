from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[4]


def _service_environment(service: dict) -> dict[str, str]:
    environment = service["environment"]
    return dict(entry.split("=", maxsplit=1) for entry in environment)


def test_sitemap_startup_warmup_is_owned_by_scheduler_worker() -> None:
    compose = yaml.safe_load((REPO_ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8"))
    backend = compose["services"]["backend"]
    worker = compose["services"]["backend-worker"]

    backend_environment = _service_environment(backend)
    worker_environment = _service_environment(worker)

    assert backend_environment["START_SCHEDULER"] == "false"
    assert backend_environment["WARM_SITEMAP_CACHE"] == "false"
    assert worker_environment["START_SCHEDULER"] == "true"
    assert worker_environment["WARM_SITEMAP_CACHE"] == "true"
    assert worker["command"][-2:] == ["--workers", "1"]


def test_example_brreg_background_limits_fit_inside_global_limits() -> None:
    env_values = dict(
        line.split("=", maxsplit=1)
        for line in (REPO_ROOT / ".env.example").read_text(encoding="utf-8").splitlines()
        if line and not line.startswith("#") and "=" in line
    )

    assert float(env_values["WORKER_BRREG_BACKGROUND_EGRESS_RATE_PER_SECOND"]) < float(
        env_values["BRREG_EGRESS_RATE_PER_SECOND"]
    )
    assert int(env_values["WORKER_BRREG_BACKGROUND_EGRESS_BURST"]) <= int(env_values["BRREG_EGRESS_BURST"])
