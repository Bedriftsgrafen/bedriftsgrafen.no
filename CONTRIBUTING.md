# Contributing to Bedriftsgrafen.no

Thank you for considering contributing to Bedriftsgrafen! This document outlines the process and guidelines for contributing to this project.

## 🤖 AI-Orchestrated Workflow

This project uses an **AI-orchestrated workflow**. Development standards are codified as "Skills" — structured markdown documents in `.agent/skills/` that define step-by-step workflows for common tasks. Both human developers and AI coding agents follow the same standards, ensuring consistency regardless of who writes the code.

You can find detailed workflows and standards in the `.agent/skills/` directory:

| Area | Skill File | Description |
|------|------------|-------------|
| **Code Review** | [.agent/skills/code_review_process/SKILL.md](.agent/skills/code_review_process/SKILL.md) | Quality standards, architecture, security, and maintainability rules. |
| **Commit Messages** | [.agent/skills/git_commit_convention/SKILL.md](.agent/skills/git_commit_convention/SKILL.md) | Strict `<type>(<scope>): <subject>` format. |
| **Safe Push** | [.agent/skills/safe_push/SKILL.md](.agent/skills/safe_push/SKILL.md) | Mandatory local validation *before* pushing. |
| **New Features** | [.agent/skills/feature_implementation/SKILL.md](.agent/skills/feature_implementation/SKILL.md) | Step-by-step checklist (Model → Repo → Service → API → UI). |
| **Migrations** | [.agent/skills/database_migration/SKILL.md](.agent/skills/database_migration/SKILL.md) | Safe Alembic migration workflow. |
| **Dependencies** | [.agent/skills/dependency_management/SKILL.md](.agent/skills/dependency_management/SKILL.md) | Adding pip/npm packages. |

## Development Setup

See [README.md](README.md#getting-started) for initial setup instructions.

### Prerequisites
- Docker & Docker Compose
- Node.js 24+ (for local frontend development)
- Python 3.14+ (for local backend development)

### Local Validation

Before pushing, always validate locally:

**Backend:**
```bash
backend/.venv/bin/ruff check backend --fix   # Linting
backend/.venv/bin/ruff format backend         # Formatting
backend/.venv/bin/mypy backend                # Type checking
backend/.venv/bin/pytest backend              # Tests
```

**Frontend:**
```bash
cd frontend
npm run validate   # Types + Lint
npm test           # Vitest + React Testing Library
```

## Pull Request Process

1. **Follow the Skills**: Ensure your code passes the **Code Review** standards.
2. **Validate Locally**: Run the lint, type check, and test commands above.
3. **Commit**: Use the **Git Commit Convention** (`<type>(<scope>): <subject>`).
4. **Push**: Incremental pushes (one commit at a time) are preferred.

## Reporting Bugs

Use GitHub Issues to report bugs. Include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
