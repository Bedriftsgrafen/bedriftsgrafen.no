FROM python:3.14-slim

WORKDIR /app

# Patch fixable OS-level CVEs and install system dependencies
RUN apt-get update && \
    apt-get upgrade -y --no-install-recommends && \
    apt-get install -y --no-install-recommends libpq-dev gcc curl && \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user before copying app code so --chown can set ownership
# in a single pass — avoids a separate chown -R layer over the source files
RUN useradd -m -u 1000 -s /bin/bash appuser

COPY --chown=appuser:appuser backend/ .

USER appuser

# Health check parity
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:${API_PORT:-8000}/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
