# Bedriftsgrafen.no — Gemini Context

**Bedriftsgrafen.no** is a financial analytics platform for 1.14M Norwegian companies.

**Stack:** React 19 + TypeScript + Vite | FastAPI + Python 3.14 | PostgreSQL 18 | Docker Compose

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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
