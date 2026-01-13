#!/bin/bash
set -e

# Smart Check Script for Bedriftsgrafen
# Detects changes and only runs validation/tests for affected components.

# Default to comparing against HEAD~1 (typical for pre-push)
# If a specific base is provided as $1, use that.
BASE=${1:-"HEAD~1"}

echo "🔍 Detecting changes against $BASE..."

# Get changed files
# If git diff fails (e.g. no remote or first commit), we run everything
COMPARED_FILES=$(git diff --name-only "$BASE" 2>/dev/null || echo "ALL")

if [ "$COMPARED_FILES" == "ALL" ]; then
    echo "⚠️  Could not determine diff. Running ALL validations."
    FRONTEND_AFFECTED=true
    BACKEND_AFFECTED=true
    ROOT_AFFECTED=true
else
    # Check for frontend changes
    FRONTEND_AFFECTED=$(echo "$COMPARED_FILES" | grep -q "^frontend/" && echo true || echo false)
    # Check for backend changes
    BACKEND_AFFECTED=$(echo "$COMPARED_FILES" | grep -q "^backend/" && echo true || echo false)
    # Check for changes outside frontend/backend, BUT ignore docs/agent/md files
    # We filter out frontend/backend first.
    # Then we filter out safe patterns (.agent/, docs/, *.md, .gitignore).
    # If anything remains, it's a root config change (e.g. package.json, docker-compose).
    ROOT_AFFECTED=$(echo "$COMPARED_FILES" | grep -vE "^(frontend/|backend/)" | grep -vE "^(\.agent/|docs/|.*\.md$|\.gitignore)" && echo true || echo false)
fi

# If root configs changed, we must run everything to be safe
if [ "$ROOT_AFFECTED" == "true" ]; then
    echo "⚙️  Root configuration or CI changes detected. Running FULL validation."
    FRONTEND_AFFECTED=true
    BACKEND_AFFECTED=true
fi

EXIT_CODE=0

# --- Frontend Validation ---
if [ "$FRONTEND_AFFECTED" == "true" ]; then
    echo "🌐 Running Frontend validation..."
    npm run validate:frontend || EXIT_CODE=1
    npm run test:frontend || EXIT_CODE=1
else
    echo "⏭️  No frontend changes detected. Skipping."
fi

# --- Backend Validation ---
if [ "$BACKEND_AFFECTED" == "true" ]; then
    echo "🐍 Running Backend validation..."
    npm run validate:backend || EXIT_CODE=1
    npm run test:backend || EXIT_CODE=1
else
    echo "⏭️  No backend changes detected. Skipping."
fi

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ Validation failed."
    exit 1
fi

echo "✅ All affected validations passed!"
