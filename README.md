# Opus Piano

Aplicación web progresiva (PWA), en español y de código abierto, para aprender a leer partituras
y a tocar el piano: solfeo, claves, notas, figuras, compases, armaduras y todos los símbolos
de la partitura, con ejercicios de práctica y una biblioteca de partituras personales que se
guardan **solo en tu dispositivo**.

- Funciona sin conexión una vez instalada; el progreso de práctica se sincroniza con el servidor (Postgres) cuando hay red.
- Los símbolos musicales se muestran con las fuentes originales del estándar SMuFL
  (Bravura / Bravura Text) y la notación se dibuja con VexFlow.
- No hay servidor ni cuentas: los PDF que subes se quedan en IndexedDB de tu teléfono.

## Desarrollo

Requiere Node 20+ y [bun](https://bun.sh).

```bash
bun install
bun dev          # http://localhost:3000
bun run build    # genera el sitio estático en ./out y el service worker
```

El resultado de `out/` se puede servir desde cualquier hosting estático (GitHub Pages, Netlify,
Vercel, un servidor propio…). Para instalar la PWA en el teléfono el sitio debe servirse por HTTPS.

## Plan de desarrollo

Ver [PLAN.md](./PLAN.md). Cada fase corresponde a un commit.

## Licencia

Código bajo licencia [MIT](./LICENSE). Las fuentes Bravura, Bravura Text y Academico
(Steinberg Media Technologies) se distribuyen bajo la SIL Open Font License 1.1.


## Arquitectura

| Servicio | Qué es | Imagen |
| --- | --- | --- |
| `web` | Next.js (salida *standalone*) + Prisma. Sirve la app y la API (`/api/profile`, `/api/progress`, `/api/omr`). | `Dockerfile` |
| `omr` | FastAPI + [oemer](https://github.com/BreezeWhite/oemer): convierte un PDF en MusicXML. Trabajos asíncronos, uno cada vez. | `omr/Dockerfile` |
| `db` | PostgreSQL 16. Solo guarda perfiles y progreso; las partituras se quedan en el dispositivo (IndexedDB). | `postgres:16-alpine` |

Sin contraseñas: cada dispositivo crea un **perfil** y guarda su id; un código de 8 letras (Ajustes) vincula otro dispositivo al mismo perfil.

## Desarrollo local

```bash
cp .env.example .env            # y ajusta POSTGRES_PASSWORD / DATABASE_URL
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db   # Postgres en localhost:5432
bun install
bunx prisma migrate dev          # crea las tablas
bun run dev                      # http://localhost:3000
# opcional, para probar la transcripción:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d omr  # oemer en localhost:8000 (OMR_URL en .env)
```

## Despliegue con Dokploy (VPS)

1. En Dokploy crea un proyecto y dentro un servicio de tipo **Compose** apuntando a este repositorio (rama `main`, archivo `docker-compose.yml`).
2. En **Environment** define `POSTGRES_PASSWORD` (larga y aleatoria). `DATABASE_URL` y `OMR_URL` los construye el compose.
3. En **Domains** asigna tu dominio al servicio `web`, puerto `3000`, con HTTPS (Let's Encrypt). Los servicios `omr` y `db` no se exponen.
4. Despliega. Al arrancar, `web` aplica las migraciones de Prisma (`prisma migrate deploy`) y luego sirve la app.

La primera build de `omr` descarga los modelos de oemer (~100 MB) y las dependencias de Python; tarda unos minutos. oemer es exigente en CPU: en un VPS pequeño, una página tarda entre 3 y 10 minutos. El volumen `pgdata` conserva la base de datos entre despliegues.
