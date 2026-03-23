# Branch Protection Rules

Configuration for GitHub branch protection on Bedriftsgrafen.no.

## Solo Developer Setup

If you're blocked from merging your own PR:

1. `Settings` → `Branches` → Edit `main` rule
2. Under "Rules applied to administrators" → **uncheck** "Do not allow bypassing the above settings"
3. Save → go merge your PR

### Recommended Solo Settings

```
main branch:
  ✅ Require pull request (approvals: 0)
  ✅ Require status checks: frontend-validate, frontend-test, backend-validate, backend-test
  ✅ Allow admin bypass
  ❌ Do NOT enable "Do not allow bypassing"
```

## Required Status Checks

From `.github/workflows/ci.yml`:
- `frontend-validate` — TypeScript + ESLint
- `frontend-test` — Vitest
- `backend-validate` — Ruff + Mypy
- `backend-test` — Pytest

From `.github/workflows/security.yml`:
- `secret-scanning`, `frontend-security`, `backend-security`
- `codeql-analysis`, `container-scanning`

## Team Settings (Future)

When adding collaborators, upgrade to:
- Required approvals: 1+
- Dismiss stale reviews on new commits
- Require conversation resolution
- Enable "Do not allow bypassing" for all users
