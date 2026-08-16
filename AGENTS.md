# Repository Guidelines

Bedriftsgrafen.no is a full-stack Norwegian company/financial data platform (~1.1M companies from Brønnøysundregistrene).
**Stack:** React 19 + TypeScript + Vite | FastAPI + Python 3.14 | PostgreSQL 18 | Redis | Docker Compose

## Read this first

**`CLAUDE.md` in the repository root is the single source of truth** for architecture, commands, conventions and invariants — the service topology, the repository/service layering, the materialized-view refresh ownership, the Brønnøysund egress guard, KPI formulas and the full command reference all live there. Read it before making changes.

This file restates only the non-negotiables and the project layout, so there is exactly one place to update when something changes.

## Project structure

Backend in `backend/`: `models/`, `schemas/`, `routers/` (public API under `routers/v1/`), `dependencies/`, `services/`, `repositories/`, `utils/`, `constants/`, Alembic in `backend/alembic/`. Tests in `backend/tests/unit/` (mirrors the source tree), `backend/tests/integration/` (needs a live DB) and `backend/tests/load/`.

Frontend in `frontend/src/`: `components/`, file-based routes in `routes/` (generated `routeTree.gen.ts` — do not hand-edit), `hooks/queries/` and `hooks/mutations/`, Zustand stores in `store/`, `lib/` (query client and keys), `utils/`, `services/`. Playwright specs in `frontend/e2e/`.

Operational scripts and systemd units in `scripts/`; observability config in `observability/`.

## Commands

Root `package.json` is the entry point: `npm run check` (validates and tests only what changed), `npm run validate`, `npm run test`, `npm run test:frontend:e2e`, `npm run security:audit`. Backend tooling runs through `backend/.venv/` with the config in `backend/pyproject.toml`. Full command reference, including how to run a single test, is in `CLAUDE.md`.

Use `docker-compose.dev.yml` when backend, database and supporting services are needed together.

## Non-negotiables

- **Language:** UI text Norwegian; code, comments and commit messages English; financial/domain variables Norwegian (`driftsresultat`, `egenkapital`, `omloepsmidler`).
- **Async everywhere** in the backend (`async def`, `asyncpg`). No blocking I/O in async functions, no N+1 queries — use `selectinload`/`joinedload`.
- **Layering:** routers → services → repositories. Routers never touch the DB; repositories hold no business rules. Every route declares a `response_model`.
- **Docker networking:** internal hostnames (`bedriftsgrafen-db`, `bedriftsgrafen-redis`), never `localhost`.
- **Testing:** add or update focused tests for every behaviour change. Backend is pytest (`asyncio_mode = auto`, polyfactory factories, Brreg always mocked); frontend is Vitest + React Testing Library, Playwright for browser flows.
- **Commits do not deploy.** Production requires `docker compose -f docker-compose.prod.yml up -d --build`. Never commit without explicit user approval.
- **Do not create new summary/status/implementation-log markdown files.** Keep progress in the conversation; update existing docs instead.

## Style

Python targets 3.14 with Ruff (line length 120) and mypy (SQLAlchemy + Pydantic plugins); per-file ignores for tests, scripts and Alembic are intentional. Tests follow `test_*.py` / `test_*` / `Test*`.

Frontend is strict TypeScript with ESLint at `--max-warnings 0`. Components are `PascalCase.tsx`, hooks `useSomething.ts`, tests in colocated `__tests__/`. Tailwind v4 patterns are documented in `frontend/STYLE_GUIDE.md`.

Husky + lint-staged run ESLint/tsc on staged frontend files and `scripts/lint-staged-backend.sh` on staged Python.

## Commits and pull requests

Conventional Commits: `<type>(<scope>): <subject>` — imperative, lowercase, no period (e.g. `fix(sync): harden Brreg update cursor`). Prefer small, reviewable commits and push incrementally.

Before opening a PR: run the relevant validation, describe the change and its risk, link related issues, include screenshots for visible UI changes, and call out migrations, operational scripts or config changes explicitly.

## Security and configuration

Start from `.env.example`; keep real secrets out of git. `observability/secrets/*.example` are templates only. Admin endpoints require `X-Admin-Key`, and `ADMIN_API_KEY` is mandatory in production. Run `npm run security:audit` before dependency- or deployment-sensitive changes.

## Workflows

Versioned skills in `.agent/skills/`: `code_review_process`, `safe_push`, `git_commit_convention`, `feature_implementation`, `database_migration`, `dependency_management`, `testing_patterns`, `lighthouse_ci`.
