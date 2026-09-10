FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# --- Build stage ---
FROM base AS build
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --filter web

COPY apps/web ./apps/web

RUN pnpm --filter web build

# --- Production stage ---
FROM node:20-slim AS production
WORKDIR /app

COPY --from=build /app/apps/web/build ./build
COPY --from=build /app/apps/web/package.json ./

RUN npm install --omit=dev

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 sveltekit
USER sveltekit

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "build"]
