# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it by emailing bedriftsgrafen@gmail.com or opening a private security advisory on GitHub.

**Please do not open public issues for security vulnerabilities.**

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅        |

## Security Considerations

This application:
- Stores sensitive database credentials in environment variables
- Requires proper `.env` configuration (see `.env.example`)
- Should be deployed with proper network security measures
- Uses CORS configuration to restrict API access
