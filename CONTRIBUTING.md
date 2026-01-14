# Contributing to Bedriftsgrafen.no

Thank you for considering contributing to Bedriftsgrafen! This document outlines the process and guidelines for contributing to this project.

## 🤖 AI-Orchestrated Workflow

This project uses an **AI-orchestrated workflow**. We define strict "Skills" that both human developers and AI agents must follow. These skills are the **single source of truth** for all development standards.

You can find detailed workflows and standards in the `.agent/skills/` directory:

| Area | Skill File | Description |
|------|------------|-------------|
| **Code Review** | [.agent/skills/code_review_process/SKILL.md](.agent/skills/code_review_process/SKILL.md) | Quality standards, architecture, security, and maintainability rules. |
| **Commit Messages** | [.agent/skills/git_commit_convention/SKILL.md](.agent/skills/git_commit_convention/SKILL.md) | Strict `<type>(<scope>): <subject>` format. |
| **Safe Push** | [.agent/skills/safe_push/SKILL.md](.agent/skills/safe_push/SKILL.md) | Mandatory local validation (`ruff`, `mypy`, `test`) *before* pushing. |
| **New Features** | [.agent/skills/feature_implementation/SKILL.md](.agent/skills/feature_implementation/SKILL.md) | Step-by-step checklist (Model -> Repo -> Service -> API -> UI). |
| **Migrations** | [.agent/skills/database_migration/SKILL.md](.agent/skills/database_migration/SKILL.md) | Safe Alembic migration workflow. |
| **Dependencies** | [.agent/skills/dependency_management/SKILL.md](.agent/skills/dependency_management/SKILL.md) | Adding pip/npm packages. |

## Development Setup

See [README.md](README.md#-getting-started) for initial setup instructions.

### Quick Start
1.  **Backend**: Uses Python 3.11+ and specific virtual environment paths.
2.  **Frontend**: Uses Node.js 22+.

Refer to the **Safe Push Skill** for the exact commands to run tests and linters locally.

## Pull Request Process

1.  **Follow the Skills**: Ensure your code passes the **Code Review** standards.
2.  **Validate Locally**: Use the workflows in **Safe Push** to run `ruff`, `mypy`, and tests.
3.  **Commit**: Use the **Git Commit Convention**.
4.  **Push**: Incremental pushes are preferred.

## Reporting Bugs

Use GitHub Issues to report bugs. Include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
