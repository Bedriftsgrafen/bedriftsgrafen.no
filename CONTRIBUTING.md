# Contributing to Bedriftsgrafen.no

Thank you for considering contributing to Bedriftsgrafen! This document outlines the process and guidelines for contributing to this project.

## About This Project

This project was developed using an **AI-orchestrated workflow**, where clear requirements and architectural decisions are defined by the product owner, and implementation is assisted by AI tools. This approach emphasizes:
- Clear, well-documented requirements and specifications
- Thoughtful architecture and design decisions
- Consistent code quality and best practices
- Rapid iteration and development cycles

When contributing, please maintain this standard by providing clear pull request descriptions and following the established patterns in the codebase.

## Development Setup

See [README.md](README.md#-getting-started) for initial setup instructions.

### Local Development

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
docker compose up -d db
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Code Style

### Frontend (TypeScript/React)
- Use TypeScript strict mode
- Follow ESLint configuration (`.eslintrc.js`)
- Use functional components with hooks
- Prefer `const` over `let`
- Use meaningful variable names
- Add comments for complex logic

### Backend (Python)
- Follow PEP 8 style guide
- Use type hints for all functions
- Run `ruff check .` before committing
- Use async/await for database operations
- Document functions with docstrings

## Testing

### Frontend Tests
```bash
cd frontend
npm run test
```

### Backend Tests
```bash
docker compose exec backend python -m pytest
```

### Type Checking
```bash
# Frontend
cd frontend && npm run tc

# Backend
cd backend && mypy .
```

## Pull Request Process

1. **Update documentation** for any new features or changes
2. **Add tests** for new functionality
3. **Ensure all tests pass** locally before submitting
4. **Update FUTURE_IDEAS.md** if proposing new features
5. **Follow commit message conventions** (see below)
6. **Request review** from maintainers

## Commit Message Conventions

We use conventional commits format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Maintenance tasks
- `perf:` Performance improvements

**Examples:**
- `feat: add company comparison feature`
- `fix: resolve geocoding batch processing error`
- `docs: update installation instructions`

## Code Review Guidelines

When reviewing pull requests:

- Be respectful and constructive
- Focus on code quality and maintainability
- Check for test coverage
- Verify documentation is updated
- Ensure no hardcoded credentials or secrets

## Reporting Bugs

Use GitHub Issues to report bugs. Include:

- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, Docker version)
- Screenshots if applicable

## Suggesting Features

Feature requests are welcome! Please:

- Check existing issues first
- Provide clear use case
- Explain expected behavior
- Consider adding it to FUTURE_IDEAS.md

## Questions?

- Open a GitHub Discussion
- Check existing documentation
- Contact: bedriftsgrafen@gmail.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
