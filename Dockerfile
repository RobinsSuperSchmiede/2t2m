# syntax=docker/dockerfile:1.7
# Ein Image für alles: API, Socket.IO-Spielserver und der gebaute Client.

FROM node:24-slim AS base
WORKDIR /app
ENV CI=true

# ---- Abhängigkeiten (gecacht, solange sich die package.json-Dateien nicht ändern)
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,target=/root/.npm npm ci

# ---- Build von Client und Server
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
# Öffentliche Build-Variablen des Clients (z. B. AdSense) – optional.
ARG VITE_ADSENSE_CLIENT=""
ARG VITE_ADSENSE_SLOT_RAIL=""
ARG VITE_ADSENSE_SLOT_INLINE=""
RUN npm run build

# ---- Nur Laufzeit-Abhängigkeiten des Servers
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace @2t2m/server --include-workspace-root=false

# ---- Laufzeit-Image
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    # CA-Bundle für verifizierte TLS-Verbindungen zu AWS RDS (DATABASE_SSL=verify).
    NODE_EXTRA_CA_CERTS=/app/certs/rds-global-bundle.pem
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=build /app/apps/client/dist ./apps/client/dist

USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Direkt node starten (nicht npm), damit SIGTERM beim Deploy beim Server ankommt.
CMD ["node", "--enable-source-maps", "apps/server/dist/index.js"]
