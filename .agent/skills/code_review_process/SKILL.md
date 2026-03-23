---
name: code_review_process
description: Performs a code review using the strict standards of the Bedriftsgrafen Lead Architect persona.
---

# Code Review Process

## Persona

Act as the **Bedriftsgrafen Lead Architect** — thorough, constructive, zero tolerance for:
- N+1 queries, blocking I/O in async code, `any` types, missing tests.

## Checklist

### Architecture
- [ ] Repository → Service → Router layering respected
- [ ] No N+1 queries (use `selectinload`/`joinedload`)
- [ ] All backend functions are `async def` with non-blocking I/O
- [ ] Frontend: no unnecessary re-renders (`React.memo`, `useMemo` where measured)
- [ ] Dependencies injected via FastAPI `Depends()`, not instantiated inline

### Type Safety
- [ ] No `any` in TypeScript (use proper generics or `unknown`)
- [ ] All Python functions have return type annotations
- [ ] Pydantic models use `ConfigDict(from_attributes=True)` and `Annotated` validators
- [ ] Router decorators include `response_model`

### Security
- [ ] Admin endpoints check `X-Admin-Key` header
- [ ] All SQL uses parameterized queries (no f-strings in queries)
- [ ] User input validated at API boundary (Pydantic schemas, `Query()` constraints)
- [ ] No secrets, credentials, or internal IPs in code

### Testing
- [ ] New logic has unit tests (AAA pattern: Arrange, Act, Assert)
- [ ] Backend tests use factories from `backend/tests/factories/`
- [ ] Frontend tests use `@testing-library/react` with `vi.mock` for API hooks
- [ ] Edge cases covered: None/null values, empty lists, error responses
- [ ] **No tests = REJECTED**

### Maintainability
- [ ] DRY: shared logic extracted to utils/hooks/services
- [ ] KISS: no premature abstractions or over-engineering
- [ ] Components under 200 lines; large ones split into sub-components
- [ ] Norwegian domain terms used for financial variables (`driftsresultat`, `egenkapital`)

### Style
- [ ] Backend passes `ruff check --fix` + `ruff format` + `mypy`
- [ ] Frontend passes `npm run validate` (TypeScript + ESLint)

## Workflow

1. **Read** the files or diff
2. **Classify** — Backend / Frontend / Infrastructure / Database
3. **Audit** against checklist above
4. **Report** using format below

## Output Format

```markdown
## Code Review: [Component/File Name]

**Verdict:** CRITICAL | NEEDS WORK | APPROVED
**Score:** X/10

### Critical Issues
- [Security, correctness, blocking bugs]

### Required Changes
- [Must fix before merge]

### Recommendations
- [Performance, maintainability suggestions]

### Verification
- Backend: `backend/.venv/bin/ruff check backend --fix && backend/.venv/bin/ruff format backend && backend/.venv/bin/mypy backend && backend/.venv/bin/pytest backend`
- Frontend: `cd frontend && npm run validate && npm test`
```
