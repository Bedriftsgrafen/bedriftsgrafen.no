# Repository Guidelines

## Project Structure & Module Organization

Bedriftsgrafen is a full-stack Norwegian business lookup app. The FastAPI backend lives in `backend/`, with models in `backend/models/`, routers in `backend/routers/`, repositories in `backend/repositories/`, services in `backend/services/`, and Alembic migrations in `backend/alembic/`. Backend tests are under `backend/tests/unit/` and `backend/tests/integration/`.

The React/Vite frontend is in `frontend/src/`. Reusable UI is in `frontend/src/components/`, routes in `frontend/src/routes/`, services in `frontend/src/services/`, hooks in `frontend/src/hooks/`, state in `frontend/src/store/`, and assets in `frontend/src/assets/` and `frontend/src/img/`. Operational scripts are in `scripts/`; observability config is in `observability/`.

## Build, Test, and Development Commands

- `npm run check`: runs the smart-check script.
- `npm run validate`: validates frontend and backend.
- `npm run test`: runs frontend Vitest tests and backend unit tests.
- `npm run validate:frontend`: runs TypeScript and ESLint in `frontend/`.
- `npm run validate:backend`: syncs the backend venv, then runs Ruff format/check and mypy.
- `npm run test:backend`: runs `pytest tests/unit -v`.
- `npm run test:frontend:e2e`: runs Playwright end-to-end tests.
- `cd frontend && npm run dev`: starts the Vite dev server.

Use `docker-compose.dev.yml` when backend, database, and supporting services are needed together.

## Coding Style & Naming Conventions

Backend Python targets Python 3.14, uses Ruff with a 120-character line length, and mypy with SQLAlchemy/Pydantic plugins. Keep modules aligned with the existing model-repository-service-router layering. Test files, functions, and classes follow `test_*.py`, `test_*`, and `Test*`.

Frontend code uses TypeScript, React 19, ESLint, and Vite. Name React components in `PascalCase.tsx`, hooks as `useSomething.ts`, and shared helpers in descriptive `camelCase` modules. Prefer colocated `__tests__/` directories where they already exist.

## Testing Guidelines

Add or update focused tests for behavior changes. Use pytest for backend unit and integration tests; coverage is configured in `backend/pyproject.toml`. Use Vitest and React Testing Library for frontend tests, and Playwright for browser workflows.

## Commit & Pull Request Guidelines

History uses Conventional Commit style: `<type>(<scope>): <subject>` or `<type>: <subject>`, for example `fix(sync): harden Brreg update cursor`. Prefer small, reviewable commits.

Before opening a PR, run relevant validation, describe the change and risk, link related issues, and include screenshots for visible UI changes. Note migrations, operational scripts, or config changes explicitly.

## Security & Configuration Tips

Start from `.env.example` and keep real secrets out of git. Use `observability/secrets/*.example` as templates only. Run `npm run security:audit` before dependency or deployment-sensitive changes.
