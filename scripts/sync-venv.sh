#!/bin/bash

# scripts/sync-venv.sh
# Automatically synchronizes the local backend virtual environment with requirements.txt

VENV_DIR="backend/.venv"
REQ_FILE="backend/requirements.txt"
MARKER_FILE="$VENV_DIR/.last_install"

# 1. If venv doesn't exist, it will be handled by the validate:backend fallback
if [ ! -d "$VENV_DIR" ]; then
    exit 0
fi

# 2. Check if requirements.txt is newer than our marker file
if [ ! -f "$MARKER_FILE" ] || [ "$REQ_FILE" -nt "$MARKER_FILE" ]; then
    echo "🔄 requirements.txt has changed. Synchronizing local .venv..."
    
    # Run pip install using the absolute path to the venv's pip
    ./"$VENV_DIR/bin/pip" install --upgrade pip
    ./"$VENV_DIR/bin/pip" install -r "$REQ_FILE"
    
    if [ $? -eq 0 ]; then
        touch "$MARKER_FILE"
        echo "✅ Local .venv synchronized."
    else
        echo "❌ Failed to synchronize .venv. Please check backend/requirements.txt"
        exit 1
    fi
fi
