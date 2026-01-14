# Antigravity Skills

This directory contains specialized skills for the Antigravity agent. Each subdirectory represents a distinct skill.

## Structure

Each skill folder must contain a `SKILL.md` file with the following:
- **YAML Frontmatter**: Metadata about the skill (name, description, etc.).
- **Markdown Body**: Detailed instructions, checklists, and procedures for the agent to follow.

## Usage

When the agent determines a task requires a specific skill, it will read the corresponding `SKILL.md` file to obtain expert knowledge and strict workflows.

## Available Skills

- **git_commit_convention**: Enforces the project's strict git commit message format and policies.
- **code_review_process**: Applies the "Bedriftsgrafen Lead Architect" standards for code reviews.
- **database_migration**: Standard procedures for safely creating and applying Alembic migrations.
- **feature_implementation**: Comprehensive checklist for implementing new features across the stack.
- **dependency_management**: Standardized workflow for adding backend (pip) and frontend (npm) packages.
- **safe_push**: Validation steps to ensure code is clean before pushing to avoiding CI failures.
