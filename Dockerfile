# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy monorepo manifests
COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/game-engine/package.json ./packages/game-engine/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/

RUN npm install --frozen-lockfile --ignore-scripts

# ─── Stage 2: Build shared packages ───────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY . .

# Build shared packages first
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=packages/game-engine

# Build server
RUN npm run build --workspace=apps/server

# Build web
RUN npm run build --workspace=apps/web

# Build admin
RUN npm run build --workspace=apps/admin

# ─── Stage 3: Production server ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy server build + node_modules
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/game-engine/dist ./packages/game-engine/dist
COPY --from=builder /app/packages/game-engine/package.json ./packages/game-engine/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy web + admin static builds for serving
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/admin/dist ./apps/admin/dist

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
