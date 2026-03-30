FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Dev stage (used by docker compose) ──────────────────────────────────────
FROM base AS dev
COPY . .
EXPOSE 4321
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ── Build stage ──────────────────────────────────────────────────────────────
FROM base AS build
COPY . .
ARG HIVE_WORKER_URL
ENV HIVE_WORKER_URL=$HIVE_WORKER_URL
RUN npm run build

# ── Preview stage (production build preview) ─────────────────────────────────
FROM base AS preview
COPY --from=build /app/dist ./dist
EXPOSE 4321
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
