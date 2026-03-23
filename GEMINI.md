# Bedriftsgrafen.no — Gemini Context

**Bedriftsgrafen.no** is a financial analytics platform for 1.14M Norwegian companies.

**Stack:** React 19 + TypeScript + Vite | FastAPI + Python 3.11 | PostgreSQL 15 | Docker Compose

## Mandatory Skills

All development must follow the skills defined in `.agent/skills/`:

| Skill | Path |
|-------|------|
| Code Review | `.agent/skills/code_review_process/SKILL.md` |
| Safe Push | `.agent/skills/safe_push/SKILL.md` |
| Git Conventions | `.agent/skills/git_commit_convention/SKILL.md` |
| Feature Implementation | `.agent/skills/feature_implementation/SKILL.md` |
| Database Migration | `.agent/skills/database_migration/SKILL.md` |
| Dependency Management | `.agent/skills/dependency_management/SKILL.md` |

## Key References

- **Architecture & patterns:** `.github/copilot-instructions.md`
- **API endpoints:** `backend/API_ENDPOINTS.md`
- **Frontend style:** `frontend/STYLE_GUIDE.md`
- **Operations:** `OPERATIONS.md`

## Conventions

- **UI text:** Norwegian. **Code/comments:** English. **Domain variables:** Norwegian (`driftsresultat`, `egenkapital`).
- **All backend code must be async** (`async def`, `asyncpg` driver).
- **Docker networking:** Services use internal hostnames (`bedriftsgrafen-db`), never `localhost`.
