---
description: detailed checklist for implementing a new full-stack feature
---

# Feature Scaffold Workflow

Follow this checklist to implement features consistently and safely.

## Phase 1: Backend Implementation

1.  **Model**: Create/Update `backend/models/<entity>.py`.
    -   *If changed*: Run `database_migration` workflow.
2.  **Repository**: Create/Update `backend/repositories/<entity>_repository.py`.
    -   Implement CRUD operations.
    -   Add Unit Tests: `backend/tests/unit/repositories/test_<entity>_repository.py`.
3.  **Service**: Create/Update `backend/services/<entity>_service.py` (Optional, if business logic is complex).
4.  **Router**: Create/Update `backend/routers/v1/<entity>.py`.
    -   Define Pydantic schemas (Request/Response).
    -   Add Unit Tests: `backend/tests/unit/routers/test_<entity>_router.py`.
5.  **Verify**:
    -   `ruff check backend`
    -   `mypy backend`
    -   `pytest backend`
6.  **Commit**: `feat(backend): implement <entity> logic`

## Phase 2: Frontend Implementation

1.  **Types**: Define interfaces in `frontend/src/types` or co-located with components.
2.  **API Hook**: Create `frontend/src/hooks/queries/use<Entity>Query.ts`.
    -   Use TanStack Query.
3.  **UI Component**: Create `frontend/src/components/<Entity>/*.tsx`.
4.  **Route**: Create `frontend/src/routes/<path>.tsx`.
5.  **Verify**:
    -   `npm run validate`
    -   `npm test`
6.  **Commit**: `feat(frontend): add <entity> ui`

## Phase 3: Push

Follow the `git_push` workflow to push your commits one by one.
