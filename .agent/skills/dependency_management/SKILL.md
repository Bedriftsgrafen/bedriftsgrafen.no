---
name: dependency_management
description: Standard instructions for adding or updating backend (pip) and frontend (npm) dependencies.
---

# Dependency Management

## Backend (pip + pip-compile)

Dependencies declared in `backend/pyproject.toml`, pinned in `backend/requirements.txt` (lock file — never edit by hand).

### Add a package

1. Edit `backend/pyproject.toml`:
   - Runtime: `[project.dependencies]`
   - Dev-only: `[project.optional-dependencies.dev]`

2. Regenerate lock file:
   ```bash
   cd backend && .venv/bin/pip-compile --output-file=requirements.txt pyproject.toml
   ```

3. Install locally:
   ```bash
   cd backend && .venv/bin/pip install -r requirements.txt
   ```

4. Commit both files:
   ```bash
   git add backend/pyproject.toml backend/requirements.txt
   git commit -m "chore(deps): add <package-name>"
   ```

### Security audit

```bash
cd backend && .venv/bin/pip-audit
```

## Frontend (npm)

### Add a package

```bash
cd frontend
npm install <package-name>       # runtime
npm install -D <package-name>    # dev-only
```

Commit both files:
```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(deps): add <package-name>"
```

### Security audit

```bash
cd frontend && npm audit
```

## Docker Rebuild

After adding dependencies, rebuild the relevant container:
```bash
# Backend
docker compose build backend && docker compose up -d

# Frontend
docker compose build frontend && docker compose up -d
```
