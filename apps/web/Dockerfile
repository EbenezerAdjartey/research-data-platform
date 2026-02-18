# Stage 1: Build
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace root files needed for pnpm install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy web app source
COPY apps/web/ ./apps/web/

# Build workspace packages first, then the web app
RUN pnpm --filter @rdp/shared-types --filter @rdp/api-client build && \
    pnpm --filter @rdp/web build

# Stage 2: Serve
FROM nginx:alpine

# Copy custom nginx config for SPA routing
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
