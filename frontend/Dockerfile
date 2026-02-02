# Development stage - for hot-reload dev environment
FROM node:25-alpine AS development

WORKDIR /app

COPY package*.json ./
# Skip prepare script (husky) - git hooks not needed in containers
RUN npm ci --ignore-scripts

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# Build stage - for creating production bundle
FROM node:25-alpine AS build

# OCI Image Labels
LABEL org.opencontainers.image.title="Bedriftsgrafen Frontend"
LABEL org.opencontainers.image.description="React frontend for Bedriftsgrafen.no"
LABEL org.opencontainers.image.source="https://github.com/Bedriftsgrafen/bedriftsgrafen.no"
LABEL org.opencontainers.image.vendor="Bedriftsgrafen"
LABEL maintainer="bedriftsgrafen@example.com"

WORKDIR /app

COPY package*.json ./
# Skip prepare script (husky) - git hooks not needed in containers
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# Production stage - for serving static files with nginx
FROM nginx:1.29-alpine AS production

# OCI Image Labels
LABEL org.opencontainers.image.title="Bedriftsgrafen Frontend"
LABEL org.opencontainers.image.description="React frontend for Bedriftsgrafen.no"
LABEL org.opencontainers.image.source="https://github.com/Bedriftsgrafen/bedriftsgrafen.no"
LABEL org.opencontainers.image.vendor="Bedriftsgrafen"
LABEL maintainer="bedriftsgrafen@example.com"

# Copy built assets with correct ownership for nginx user
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Remove default nginx configs for security
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy nginx configuration
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

# Switch to non-root nginx user
USER nginx

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
