# Bedriftsgrafen.no — Gemini Context

**Bedriftsgrafen.no** is a financial analytics platform for ~1.1M Norwegian companies.
**Stack:** React 19 + TypeScript + Vite | FastAPI + Python 3.14 | PostgreSQL 18 | Redis | Docker Compose

## Read this first

**`CLAUDE.md` in the repository root is the single source of truth** for architecture, commands, conventions and invariants. Read it before making changes. This file only restates the non-negotiables; it deliberately does not duplicate anything else, so it cannot drift.

## Non-negotiables

- **Language:** UI text Norwegian. Code, comments and commit messages English. Financial/domain variables Norwegian (`driftsresultat`, `egenkapital`, `omloepsmidler`).
- **Async everywhere** in the backend (`async def`, `asyncpg`). No blocking I/O in async functions, no N+1 queries.
- **Layering:** routers → services → repositories. Routers never touch the DB; repositories hold no business rules.
- **Docker networking:** internal hostnames (`bedriftsgrafen-db`, `bedriftsgrafen-redis`), never `localhost`.
- **Verify before pushing:** `npm run check` (or `npm run validate && npm run test`). New behaviour without tests is incomplete.
- **Commits do not deploy.** Production requires `docker compose -f docker-compose.prod.yml up -d --build`. Never commit without explicit user approval.
- **Do not create new summary/status markdown files.** Keep progress in the conversation.

## Workflows

Versioned skills in `.agent/skills/`: `code_review_process`, `safe_push`, `git_commit_convention`, `feature_implementation`, `database_migration`, `dependency_management`, `testing_patterns`, `lighthouse_ci`.

## Further reference

`CLAUDE.md` · `backend/API_ENDPOINTS.md` · `frontend/STYLE_GUIDE.md` · `OPERATIONS.md` · `.github/copilot-instructions.md` (code examples)
