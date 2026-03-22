---
name: dependency_management
description: Standard instructions for adding or updating backend (pip) and frontend (npm) dependencies.
---

# Dependency Management Skill

## Backend (Pip/pyproject.toml)

Dependencies are declared in `pyproject.toml` and pinned in `requirements.txt` (the generated lock file — do NOT edit by hand).

### 1. Add to `pyproject.toml`
Add runtime deps under `[project.dependencies]`, dev-only deps under `[project.optional-dependencies.dev]`:
```toml
[project.dependencies]
"package-name>=1.2.3"
```

### 2. Regenerate lock file
```bash
cd backend
.venv/bin/pip-compile --output-file=requirements.txt pyproject.toml
```

### 3. Sync local venv
```bash
./.venv/bin/pip install -r requirements.txt
```

### 4. Commit
```bash
git add backend/pyproject.toml backend/requirements.txt
git commit -m "chore(backend): add package-name"
```

---

## Frontend (NPM)

The frontend uses `npm`.

### 1. Install Package
```bash
cd frontend
npm install <package-name>
# OR for dev dependencies
npm install -D <package-name>
```

### 2. Verify
Ensure `package.json` and `package-lock.json` are updated.

### 3. Commit
```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): add <package-name>"
```
