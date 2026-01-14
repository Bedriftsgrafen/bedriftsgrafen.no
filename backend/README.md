# Bedriftsgrafen Backend

The FastAPI-based backend service for Bedriftsgrafen.no.

## 🛠️ Tech Stack

- **Framework**: FastAPI (Python 3.11)
- **Database**: PostgreSQL with SQLAlchemy (Async) & Alembic
- **Search**: PostgreSQL Full-Text Search
- **Task Scheduling**: APScheduler (for data sync)

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Python 3.11+ (for local development without Docker)

**Note:** For dependency management, please refer to the [Dependency Management Skill](../.agent/skills/dependency_management/SKILL.md).

### Running Locally

See the root [README.md](../README.md) for Docker-based setup (recommended).

To run locally without Docker:

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --reload
```

## 📁 Project Structure

- `alembic/`: Database migrations
- `routers/`: API route handlers
- `services/`: Business logic
- `models.py`: SQLAlchemy database models
- `schemas/`: Pydantic models for request/response validation
- `scripts/`: Operational scripts (imports, indexing, etc.)

## 📚 API Documentation

Once running, interactive API docs are available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

See [API_ENDPOINTS.md](API_ENDPOINTS.md) for a summary of key endpoints.
