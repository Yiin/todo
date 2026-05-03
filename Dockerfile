# syntax=docker/dockerfile:1

# Multi-stage build: installs web deps, builds the Vue SPA, installs api
# production deps, and assembles a slim runtime image that serves both
# /api/* and the built SPA from a single Bun process.

FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# --- web deps (dev + prod, needed for `vite build`) ---
FROM base AS install-web-deps
RUN mkdir -p /tmp/web-deps
COPY web/package.json web/bun.lock /tmp/web-deps/
RUN cd /tmp/web-deps && bun install --frozen-lockfile

# --- api deps (production only) ---
FROM base AS install-api-deps-prod
RUN mkdir -p /tmp/api-deps
COPY api/package.json api/bun.lock /tmp/api-deps/
RUN cd /tmp/api-deps && bun install --frozen-lockfile --production

# --- build the web SPA ---
FROM base AS build-web
COPY --from=install-web-deps /tmp/web-deps/node_modules ./web/node_modules
COPY web ./web
ENV NODE_ENV=production
# Skip vue-tsc type-check inside the container: vue-tsc relies on a real
# `node` binary (its shebang is `#!/usr/bin/env node`), and the `oven/bun`
# image ships a Bun-based `node` shim that mis-handles the `.vue` virtual
# module resolution used by vue-tsc/volar. Type-checking is enforced in
# the dev workflow; `build-only` performs the actual Vite production
# bundle, which is what we need here.
RUN cd web && bun run build-only

# --- final runtime image ---
FROM base AS release

# API source + manifest
COPY --from=install-api-deps-prod /tmp/api-deps/node_modules ./api/node_modules
COPY api/package.json ./api/package.json
COPY api/src ./api/src

# Built SPA → served as static + SPA fallback by api/src/index.ts
COPY --from=build-web /usr/src/app/web/dist ./public

ENV STATIC_DIR=/usr/src/app/public \
    NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/todo.db

# The sqlite file lives in /data, which must be mounted as a volume.
# Bun user needs to write to it.
USER root
RUN mkdir -p /data && chown -R bun:bun /data /usr/src/app
USER bun

EXPOSE 3000

# Entrypoint note: we run from /usr/src/app (not /usr/src/app/api) so the
# default STATIC_DIR resolution and api/node_modules path stay predictable;
# the server imports ./db.ts relative to src/index.ts, which is unaffected.
ENTRYPOINT ["bun", "run", "api/src/index.ts"]
