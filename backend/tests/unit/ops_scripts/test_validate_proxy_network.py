import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[4] / "scripts" / "validate_proxy_network.py"
SPEC = importlib.util.spec_from_file_location("validate_proxy_network", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def payload(subnet="172.19.0.0/16", container="nginx-proxy-manager-app-1"):
    return [{"IPAM": {"Config": [{"Subnet": subnet}]}, "Containers": {"id": {"Name": container}}}]


def test_accepts_exact_network_and_proxy_membership():
    assert MODULE.validate("set_real_ip_from 172.19.0.0/16;", payload(), "nginx-proxy-manager-app-1") == (
        "172.19.0.0/16"
    )


@pytest.mark.parametrize(
    ("config", "network_payload"),
    [
        ("set_real_ip_from 172.20.0.0/16;", payload()),
        ("", payload()),
        ("set_real_ip_from 172.19.0.0/16;\nset_real_ip_from 10.0.0.0/8;", payload()),
        ("set_real_ip_from 172.19.0.0/16;", payload(container="other")),
    ],
)
def test_rejects_mismatch_ambiguous_config_or_missing_proxy(config, network_payload):
    with pytest.raises(ValueError):
        MODULE.validate(config, network_payload, "nginx-proxy-manager-app-1")


def test_nginx_rate_limits_the_verified_real_ip():
    config = (Path(__file__).resolve().parents[4] / "frontend" / "nginx.master.conf").read_text()
    assert "real_ip_recursive on;" in config
    assert "real_ip_header X-Forwarded-For;" in config
    assert "limit_req_zone $binary_remote_addr" in config
    assert "proxy_add_x_forwarded_for" not in config
