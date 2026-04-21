---
name: git_commit_convention
description: Enforces the Bedriftsgrafen project's strict git commit message format and policies.
---

# Git Commit Convention

## ⛔ HARD STOP — REVIEW BEFORE COMMIT

**Commits and pushes are GATED on explicit user approval. NO EXCEPTIONS.**

The agent MUST stop after implementation and validation, then **wait** for the user to:

1. Review the diff (`git diff` or VS Code Source Control panel).
2. Send an explicit approval signal: `ok`, `commit`, `lgtm`, `approved`, `ship it`, or similar.

**Do NOT commit just because:**
- Tests pass ✅ (this is necessary, not sufficient)
- The plan was previously approved ❌ (plan ≠ implementation approval)
- The user said "go" to start implementation ❌ ("go" means start coding, not commit)
- The change feels small/safe ❌ (consistency matters)

**Workflow that MUST be followed:**

```
1. Plan → user approves plan
2. Implement ALL phases to completion (code + tests + validation).
   Do NOT stop mid-stream to ask about commits.
3. Run full validation gauntlet (ruff, mypy, pytest, npm validate, npm test).
4. STOP at a SINGLE final gate. Report:
   - What was done (phase-by-phase bullet list)
   - `git status` output (unstaged/untracked files)
   - Proposed commit sequence (one commit per logical phase)
5. Wait for explicit approval keyword.
6. Only then: stage + commit each phase separately (preserves clean history).
7. Push only if explicitly asked ("push", "ship", etc.).
```

**One gate, not many.** The user wants to review the full change once, not approve each phase individually. If in doubt, ask: "All phases done. Ready to commit? Summary: <...>. Approve?"

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
