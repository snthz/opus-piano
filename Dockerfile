# Opus Piano — Next.js (salida standalone) + Prisma.
# La imagen se construye en GitHub Actions y se publica en ghcr.io; el VPS solo la descarga.
# Se construye con bun (como en desarrollo) y se ejecuta con Node.

FROM oven/bun:1-debian AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-debian AS build
WORKDIR /app
# El dominio se incrusta al compilar: las páginas se prerenderizan y con ellas
# las URL canónicas, el sitemap y las etiquetas Open Graph.
ARG SITE_URL=https://opuspiano.app
ENV NEXT_TELEMETRY_DISABLED=1 SITE_URL=$SITE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate \
 && bun run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
# Límite del heap de Node: la app es ligera y así nunca crece más de lo previsto en el VPS.
ENV NODE_OPTIONS=--max-old-space-size=256 SCORES_DIR=/data/scores
# Prisma (motor de consultas y migraciones) necesita OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g prisma@6.19.3 && npm cache clean --force \
 && groupadd -r app && useradd -r -g app app \
 && mkdir -p /data/scores && chown app:app /data/scores

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://localhost:3000/api/health || exit 1
# Las migraciones se aplican al arrancar; así un despliegue nuevo actualiza la base de datos.
CMD ["sh", "-c", "prisma migrate deploy --schema ./prisma/schema.prisma && node server.js"]
