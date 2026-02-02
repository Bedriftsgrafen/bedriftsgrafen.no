# Development stage - for hot-reload dev environment
FROM node:24-alpine AS development

WORKDIR /app

COPY package*.json ./
# Skip prepare script (husky) - git hooks not needed in containers
RUN npm ci --ignore-scripts

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# Build stage - for creating production bundle
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
# Skip prepare script (husky) - git hooks not needed in containers
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# Production stage - for serving static files with nginx
FROM nginx:1.28-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
