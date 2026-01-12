#!/bin/bash

# scripts/lint-staged-backend.sh
# This script adapts the paths passed by lint-staged (host absolute paths)
# to the paths expected by the backend docker container (/app/...).

# Get the project root (where the script is running from)
PROJECT_ROOT=$(pwd)

# Prepare the file list for the container
CONTAINER_FILES=""

for file in "$@"; do
    # Remove project root prefix
    # If the file path starts with PROJECT_ROOT, remove it.
    if [[ "$file" == "$PROJECT_ROOT"* ]]; then
        REL_PATH="${file#$PROJECT_ROOT/}"
    else
        REL_PATH="$file"
    fi
  
    # Check if it starts with backend/
    if [[ "$REL_PATH" == backend/* ]]; then
        # Remove backend/ prefix and prepend /app/
        CONTAINER_PATH="/app/${REL_PATH#backend/}"
        CONTAINER_FILES="$CONTAINER_FILES $CONTAINER_PATH"
    fi
done

if [ -n "$CONTAINER_FILES" ]; then
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "bedriftsgrafen-backend-dev"; then
        echo "❌ Error: bedriftsgrafen-backend-dev container is not running."
        echo "   Please start it with 'npm run dev-up' (or your preferred dev-up alias)."
        exit 1
    fi

    # Execute ruff in docker
    echo "Running ruff in docker on: $CONTAINER_FILES"
    docker exec bedriftsgrafen-backend-dev ruff check --fix $CONTAINER_FILES
else
    echo "No files to lint in backend."
fi
