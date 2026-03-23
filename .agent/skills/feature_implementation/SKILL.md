---
name: feature_implementation
description: Full-stack checklist for implementing new features consistently and safely.
---

# Feature Implementation

## Phase 1: Backend

Follow this order — each step builds on the previous:

1. **Model** — `backend/models/<entity>.py`
   - Define SQLAlchemy ORM class extending `Base`
   - If schema changed → use **database_migration** skill

2. **Schema** — `backend/schemas/<entity>.py`
   - Pydantic response/request models with `ConfigDict(from_attributes=True)`
   - Separate `Create`, `Update`, and `Response` schemas

3. **Repository** — `backend/repositories/<entity>_repository.py`
   - Async CRUD operations using `AsyncSession`
   - Use `selectinload`/`joinedload` to prevent N+1
   - Test: `backend/tests/unit/repositories/test_<entity>_repository.py`

4. **Service** — `backend/services/<entity>_service.py` (if business logic needed)
   - Orchestrates repository calls, external APIs, KPI calculations
   - Injected via `Depends()` in routers

5. **Router** — `backend/routers/v1/<entity>.py`
   - Use `response_model` on all decorators
   - Inject service via dependency: `service: EntityService = Depends(get_entity_service)`
   - Register in `backend/main.py` with prefix
   - Test: `backend/tests/unit/routers/test_<entity>.py`

6. **Verify**: Run `safe_push` backend validation
7. **Commit**: `feat(backend): implement <entity> logic`

## Phase 2: Frontend

1. **Types** — `frontend/src/types/<entity>.ts`
   - Mirror backend Pydantic schemas as TypeScript interfaces

2. **Query Hook** — `frontend/src/hooks/queries/use<Entity>Query.ts`
   - TanStack Query v5: `useQuery` / `useSuspenseQuery`
   - Return `{ data, isLoading, error }`

3. **Store** (if UI state needed) — `frontend/src/store/<entity>Store.ts`
   - Zustand for client-side state (selections, filters, toggles)

4. **Component** — `frontend/src/components/<Entity>/`
   - Tailwind CSS v4, `<ResponsiveContainer>` for charts
   - All user-facing text in Norwegian

5. **Route** — `frontend/src/routes/<path>.tsx`
   - Use lazy loading: `const Page = lazy(() => import(...))`
   - Add `<title>` and `<meta>` for SEO

6. **Verify**: Run `safe_push` frontend validation
7. **Commit**: `feat(frontend): add <entity> ui`

## Phase 3: Push

Use the **safe_push** skill to push commits incrementally.
