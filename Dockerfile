# Opus Piano — Next.js (salida standalone) + Prisma.
# Se construye con bun (como en desarrollo) y se ejecuta con Node.

FROM oven/bun:1-debian AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-debian AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate \
 && bun run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
# Prisma (motor de consultas y migraciones) necesita OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g prisma@6 \
 && groupadd -r app && useradd -r -g app app

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma

USER app
EXPOSE 3000
# Las migraciones se aplican al arrancar; así un despliegue nuevo actualiza la base de datos.
CMD ["sh", "-c", "prisma migrate deploy --schema ./prisma/schema.prisma && node server.js"]
