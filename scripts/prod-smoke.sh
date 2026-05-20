#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://bedriftsgrafen.no}"
RUNS="${RUNS:-5}"
WARMUP_RUNS="${WARMUP_RUNS:-1}"
HEALTH_BUDGET="${HEALTH_BUDGET:-0.500}"
COMPANY_SEARCH_BUDGET="${COMPANY_SEARCH_BUDGET:-0.500}"
PERSON_AUTOCOMPLETE_BUDGET="${PERSON_AUTOCOMPLETE_BUDGET:-0.500}"
PERSON_RESULTS_BUDGET="${PERSON_RESULTS_BUDGET:-1.500}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

check_latency() {
  local label="$1"
  local path="$2"
  local max_seconds="$3"
  local url="${BASE_URL}${path}"

  python3 - "$label" "$url" "$max_seconds" "$RUNS" "$WARMUP_RUNS" <<'PY'
import statistics
import subprocess
import sys

label, url, max_seconds_raw, runs_raw, warmup_runs_raw = sys.argv[1:]
max_seconds = float(max_seconds_raw)
runs = int(runs_raw)
warmup_runs = int(warmup_runs_raw)
times: list[float] = []

for request_index in range(warmup_runs + runs):
    result = subprocess.run(
        [
            "curl",
            "--silent",
            "--show-error",
            "--output",
            "/dev/null",
            "--write-out",
            "%{http_code} %{time_total}",
            "--max-time",
            str(max(max_seconds * 4, 8)),
            url,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    status_raw, elapsed_raw = result.stdout.strip().split()
    status = int(status_raw)
    elapsed = float(elapsed_raw)
    if status < 200 or status >= 400:
        raise SystemExit(f"{label}: expected HTTP 2xx/3xx, got {status} for {url}")
    if request_index >= warmup_runs:
        times.append(elapsed)

median = statistics.median(times)
print(f"{label}: median={median:.3f}s max={max(times):.3f}s budget={max_seconds:.3f}s")

if median > max_seconds:
    raise SystemExit(f"{label}: latency budget exceeded; observed median {median:.3f}s > {max_seconds:.3f}s")
PY
}

check_header_contains() {
  local label="$1"
  local path="$2"
  local header_name="$3"
  local expected="$4"
  local headers

  headers=$(curl --silent --show-error --head --max-time 8 "${BASE_URL}${path}")
  if ! printf '%s' "$headers" | grep -i "^${header_name}:" | grep -q "$expected"; then
    echo "${label}: ${header_name} does not contain '${expected}'" >&2
    exit 1
  fi
  echo "${label}: ${header_name} contains '${expected}'"
}

check_latency "health" "/api/health" "$HEALTH_BUDGET"
check_latency "company search" "/api/v1/companies/search?name=equinor&limit=10" "$COMPANY_SEARCH_BUDGET"
check_latency "person autocomplete" "/api/v1/people/search?q=ola&limit=5" "$PERSON_AUTOCOMPLETE_BUDGET"
check_latency "person results" "/api/v1/people/search/results?q=ola&limit=20&offset=0" "$PERSON_RESULTS_BUDGET"
check_header_contains "csp" "/" "Content-Security-Policy" "googletagmanager.com"
check_header_contains "csp" "/" "Content-Security-Policy" "google-analytics.com"

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q '^bedriftsgrafen-backend$'; then
  if docker logs --since 10m bedriftsgrafen-backend 2>&1 | grep -Ei 'traceback|exception|error' >/tmp/bedriftsgrafen-smoke-backend.log; then
    echo "backend logs contain recent errors; see /tmp/bedriftsgrafen-smoke-backend.log" >&2
    exit 1
  fi
  echo "backend logs: no recent error markers"
fi

echo "Production smoke passed for ${BASE_URL}"