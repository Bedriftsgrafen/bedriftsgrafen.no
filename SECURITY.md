# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by emailing bedriftsgrafen@gmail.com or opening a [private security advisory](https://github.com/Bedriftsgrafen/bedriftsgrafen.no/security/advisories/new) on GitHub.

**Please do not open public issues for security vulnerabilities.**

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅        |

## Security Measures

### Automated Scanning

- **Dependabot** — weekly dependency updates for npm, pip, Docker images, and GitHub Actions
- **CI Security Workflow** (`.github/workflows/security.yml`) — runs on every PR and weekly:
  - GitGuardian secret scanning
  - `npm audit` + OWASP Dependency-Check (frontend)
  - `safety` + `pip-audit` + Bandit SAST (backend)
  - CodeQL analysis (JavaScript + Python)
  - Trivy container image scanning
  - License compliance check

### Container Hardening

- Non-root users in all containers (`appuser`, `nginx`)
- Pinned base image versions
- Multi-stage builds to minimize attack surface
- Nginx security headers (CSP, X-Frame-Options, HSTS, etc.)

### Local Security Tooling

```bash
npm run security:audit    # Run full local security scan
npm run security:frontend # Frontend-only audit
```

### Configuration

- Database credentials stored in environment variables (`.env`, never committed)
- Admin endpoints (`/admin/*`) require `X-Admin-Key` header; enforced at startup in production
- CORS restricts API access to allowed origins
- Rate limiting via SlowAPI + Redis (100 req/min)
- PostgreSQL statement timeout (5s) prevents slow query abuse
