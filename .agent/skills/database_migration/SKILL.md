---
name: database_migration
description: How to safely create, apply, and verify database migrations using Alembic.
---

# Database Migration

Use when modifying SQLAlchemy models in `backend/models/*.py`.

## Generate

```bash
cd backend && .venv/bin/alembic revision --autogenerate -m "describe_your_change"
```

## Review (CRITICAL)

Open the new file in `backend/alembic/versions/` and verify:
- It contains ONLY your intended changes
- No unexpected `drop_table`, `drop_column`, or `drop_index`
- Column types and nullability are correct
- Default values are set where needed

If autogenerate picked up unwanted changes, delete the file and investigate.

## Apply

```bash
cd backend && .venv/bin/alembic upgrade head
```

Verify in psql:
```bash
docker exec -it bedriftsgrafen-db psql -U admin -d selskaper -c "\d+ <table_name>"
```

## Rollback

To undo the last migration:
```bash
cd backend && .venv/bin/alembic downgrade -1
```

To see current state:
```bash
cd backend && .venv/bin/alembic current
cd backend && .venv/bin/alembic history --verbose
```

## Data Migrations

For migrations that modify **data** (not just schema):
- Write explicit `op.execute()` SQL in the migration file
- Test with a small dataset first
- Include a rollback path in `downgrade()`
- Consider running during low-traffic hours (see `OPERATIONS.md`)

## Commit

```bash
git add backend/models/ backend/alembic/versions/
git commit -m "chore(db): add migration for <feature>"
```
