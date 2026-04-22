---
name: safe_push
description: Validates code locally before pushing to prevent CI failures.
---

# Safe Push

## Local Validation (MANDATORY before every push)

### Backend changes (`backend/`)

Run in order — stop on any failure:

```bash
# Format + lint + type-check + test (one-liner)
backend/.venv/bin/ruff check backend --fix \
  && backend/.venv/bin/ruff format backend \
  && backend/.venv/bin/mypy backend --config-file backend/pyproject.toml \
  && backend/.venv/bin/pytest backend
```

If only a small area changed, run targeted tests first for fast feedback:
```bash
backend/.venv/bin/pytest backend/tests/unit/routers/test_companies.py -x
```

Then run the full suite before push.

### Frontend changes (`frontend/`)

```bash
cd frontend

# TypeScript type-check + ESLint (one command)
npm run validate

# Run tests
npm test
```

### Both changed

Run backend validation first, then frontend.

## Push Strategy

The pre-push hook runs the **full test suite** per push. Pushing N commits = N full runs.

1. Check pending commits: `git log --oneline origin/main..HEAD`
2. Push incrementally (oldest first):
   ```bash
   git push origin <commit_hash>:main
   ```
3. Wait for hook to pass before pushing the next commit.

## On Failure

- **ruff check** errors → fix the lint issue (often auto-fixable with `--fix`). Structural changes like removed imports may affect formatting.
- **ruff format** changed files → stage the formatting changes, amend or add a commit.
- **mypy** errors → fix type annotations. Never use `# type: ignore` without a comment explaining why.
- **pytest** failures → fix the test or the code. Never skip tests to push.
- **npm run validate** errors → fix TypeScript or ESLint issues before proceeding.
