---
name: git_commit_convention
description: Enforces the Bedriftsgrafen project's strict git commit message format and policies.
---

# Git Commit Convention

## Format

```
<type>(<scope>): <subject>

<body (optional)>
```

### Types

`feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `chore`

### Scopes (project-specific)

| Scope | Area |
|-------|------|
| `api` | Backend routers, middleware, rate limiting |
| `backend` | Backend general (services, utils, config) |
| `frontend` | Frontend general (components, routes, hooks) |
| `db` | Database schema, migrations, queries |
| `search` | Full-text search (FTS) |
| `kpi` | KPI calculations |
| `import` | Data import/sync from Brønnøysund |
| `auth` | Authentication, admin keys |
| `ci` | CI/CD, pre-push hooks |
| `deps` | Dependency updates |
| `docker` | Docker config, compose files |
| `scheduler` | Cron jobs, scheduled tasks |

### Subject Rules

- Imperative mood: "add" not "added"
- Lowercase first letter
- No trailing period
- Max 72 characters for type + scope + subject line

## Examples

```bash
# Simple feature
git commit -m "feat(api): add municipality endpoint with county lookup"

# Bug fix
git commit -m "fix(search): handle empty query string in FTS"

# Multi-line with body
git commit -m "refactor(kpi): extract safe_divide to shared utility

Moved _safe_divide from KpiService to utils/math.py so it can be
reused by TrendsService without circular imports."

# Chore
git commit -m "chore(deps): update tanstack-query to v5.62"
```

## Pre-Commit Checklist

1. Run `safe_push` validation (format, lint, type-check, test)
2. Stage only related files — no unrelated changes in one commit
3. Review diff: `git diff --staged`

## Policy

- **NEVER** commit without explicit user approval ("ok", "commit", "lgtm")
- **NEVER** use `--no-verify` to skip pre-push hooks
- **NEVER** force-push without user confirmation
