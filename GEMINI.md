# Bedriftsgrafen.no Context

## Project Overview

**Bedriftsgrafen.no** is a full-stack business intelligence platform that tracks and visualizes financial data for over 1.1 million Norwegian companies.

**Key Technologies:**
*   **Frontend:** React 19, TypeScript, Vite, Tailwind v4, TanStack Query v5.
*   **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (Async), Pydantic V2.
*   **Database:** PostgreSQL (Async + FTS) + Redis.
*   **Infrastructure:** Docker Compose (Service orchestration).

## 🧠 Antigravity Skills & Standards (CRITICAL)

The project uses a strict, AI-orchestrated workflow defined by **Skills** located in `.agent/skills/`.

**You MUST follow these skills:**

1.  **Code Review** (`.agent/skills/code_review_process`):
    *   Act as "Bedriftsgrafen Lead Architect".
    *   **Standards**: No N+1 queries, strict types (no `any`), mandatory tests, secure checks (`X-Admin-Key`).
    *   **Maintainability**: Enforce DRY and KISS.

2.  **Safe Push** (`.agent/skills/safe_push`):
    *   **Mandatory Local Validation** before pushing.
    *   Backend: `backend/.venv/bin/ruff check backend && backend/.venv/bin/mypy backend && backend/.venv/bin/pytest backend`
    *   Frontend: `cd frontend && npm run check`

3.  **Git Conventions** (`.agent/skills/git_commit_convention`):
    *   Format: `<type>(<scope>): <subject>` (e.g., `feat(api): add company endpoint`).

4.  **Feature Implementation** (`.agent/skills/feature_implementation`):
    *   Follow checklist: Model -> Repo -> Service -> Router -> Frontend.

*Refer to `.cursorrules` (automatically loaded) for quick access to these standards.*

## Development Workflow

### Local Setup (Hybrid)
We use Docker for services (DB, Redis) but prefer **local execution** for code validation to support the `safe_push` skill.

*   **Backend**: Run validation using specific venv paths (`backend/.venv/bin/...`).
*   **Frontend**: Run `npm run dev` and `npm test` locally.

### Key Commands

| Action | Command |
| :--- | :--- |
| **Start Services** | `docker compose -f docker-compose.dev.yml up -d` |
| **Verify Backend** | See `safe_push` skill (Ruff, Mypy, Pytest) |
| **Verify Frontend** | `cd frontend && npm run check` |
| **New Migration** | See `database_migration` skill |

## Data Management
*   **Import Scripts:** `scripts/`
*   **Migrations:** Managed via Alembic in `backend/alembic/`.
