#!/usr/bin/env python3
"""Validate that nginx trusts exactly the Docker network used by the outer proxy."""

from __future__ import annotations

import argparse
import ipaddress
import json
import re
import subprocess
from pathlib import Path
from typing import Any


def configured_trusted_network(
    config_text: str,
) -> ipaddress.IPv4Network | ipaddress.IPv6Network:
    values = re.findall(
        r"^\s*set_real_ip_from\s+([^;]+);", config_text, flags=re.MULTILINE
    )
    if len(values) != 1:
        raise ValueError(
            f"expected exactly one set_real_ip_from directive, found {len(values)}"
        )
    return ipaddress.ip_network(values[0].strip(), strict=True)


def inspect_network(
    payload: list[dict[str, Any]], trusted_container: str
) -> ipaddress.IPv4Network | ipaddress.IPv6Network:
    if len(payload) != 1:
        raise ValueError("docker network inspect must return exactly one network")
    configs = payload[0].get("IPAM", {}).get("Config", [])
    subnets = [item.get("Subnet") for item in configs if item.get("Subnet")]
    if len(subnets) != 1:
        raise ValueError(f"expected exactly one Docker subnet, found {len(subnets)}")
    container_names = {
        item.get("Name") for item in payload[0].get("Containers", {}).values()
    }
    if trusted_container not in container_names:
        raise ValueError(
            f"trusted proxy container {trusted_container!r} is not attached to the network"
        )
    return ipaddress.ip_network(subnets[0], strict=True)


def validate(
    config_text: str, payload: list[dict[str, Any]], trusted_container: str
) -> str:
    configured = configured_trusted_network(config_text)
    actual = inspect_network(payload, trusted_container)
    if configured != actual:
        raise ValueError(f"nginx trusts {configured}, but Docker network uses {actual}")
    return str(actual)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--network", default="web-proxy")
    parser.add_argument(
        "--nginx-config", type=Path, default=Path("frontend/nginx.master.conf")
    )
    parser.add_argument("--trusted-container", default="nginx-proxy-manager-app-1")
    args = parser.parse_args()

    result = subprocess.run(
        ["docker", "network", "inspect", args.network],
        check=True,
        capture_output=True,
        text=True,
    )
    network = validate(
        args.nginx_config.read_text(), json.loads(result.stdout), args.trusted_container
    )
    print(
        f"Proxy trust validated: {args.network}={network}, container={args.trusted_container}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
