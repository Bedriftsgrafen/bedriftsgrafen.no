# =============================================================================
# Frontend Dockerfile (Monorepo/Workspace aware)
# =============================================================================
# This Dockerfile is designed to be run from the PROJECT ROOT context.
# Example: docker build -f frontend/Dockerfile .

# Development stage - for hot-reload dev environment
FROM node:24-alpine AS development

WORKDIR /app

# Copy workspace configuration
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies for the whole workspace
# (In dev we install everything because volumes will map the source)
RUN npm ci --ignore-scripts

WORKDIR /app/frontend
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# Build stage - for creating production bundle
FROM node:24-alpine AS build

WORKDIR /app

# Copy workspace configuration
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies (only what's needed for frontend workspace)
RUN npm ci --ignore-scripts

# Copy frontend source
COPY frontend/ ./frontend/

# Build the app
WORKDIR /app/frontend
RUN npm run build

# Pre-compress static assets at maximum gzip level
# This allows nginx gzip_static to serve pre-compressed files without CPU cost
RUN find /app/frontend/dist -type f \
  \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.json" -o -name "*.svg" \) \
  -exec gzip -9 -k {} \;

# Production stage - for serving static files with nginx
FROM nginx:1.31-alpine AS production

# OCI Image Labels
LABEL org.opencontainers.image.title="Bedriftsgrafen Frontend"
LABEL org.opencontainers.image.description="React frontend for Bedriftsgrafen.no"
LABEL org.opencontainers.image.source="https://github.com/Bedriftsgrafen/bedriftsgrafen.no"
LABEL org.opencontainers.image.vendor="Bedriftsgrafen"
LABEL maintainer="bedriftsgrafen@example.com"

# Patch fixable OS-level CVEs in the base image
RUN apk upgrade --no-cache

# Setup permissions for non-root execution
RUN mkdir -p /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

# Copy built assets with correct ownership
COPY --from=build --chown=nginx:nginx /app/frontend/dist /usr/share/nginx/html

# Copy nginx configurations
COPY --from=build --chown=nginx:nginx /app/frontend/nginx.master.conf /etc/nginx/nginx.conf
COPY --from=build --chown=nginx:nginx /app/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /app/frontend/security-headers.conf /etc/nginx/security-headers.conf

# Switch to non-root nginx user
USER nginx

# Health check endpoint (now on 8080)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
