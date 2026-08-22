#!/usr/bin/env bash

# Keep the local backend environment identical to the compiled requirements.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

VENV_DIR="${VENV_DIR:-$REPO_ROOT/backend/.venv}"
REQ_FILE="${REQ_FILE:-$REPO_ROOT/backend/requirements.txt}"
PYTHON="$VENV_DIR/bin/python"
PIP_SYNC="$VENV_DIR/bin/pip-sync"

# validate:backend falls back to the development container when no local venv exists.
if [[ ! -d "$VENV_DIR" ]]; then
    exit 0
fi

if [[ ! -x "$PYTHON" ]]; then
    echo "Invalid backend virtual environment: $PYTHON is missing" >&2
    exit 1
fi

if [[ ! -f "$REQ_FILE" ]]; then
    echo "Backend requirements file is missing: $REQ_FILE" >&2
    exit 1
fi

# A newly created or partially installed venv may not have pip-tools yet.
if [[ ! -x "$PIP_SYNC" ]]; then
    echo "Bootstrapping backend dependencies from requirements.txt..."
    "$PYTHON" -m pip install --requirement "$REQ_FILE"
fi

if [[ ! -x "$PIP_SYNC" ]]; then
    echo "pip-sync is unavailable after dependency bootstrap" >&2
    exit 1
fi

# Run on every validation so packages installed outside the lock file are removed.
"$PIP_SYNC" "$REQ_FILE"
