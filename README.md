# Opus Piano

Aplicación web progresiva (PWA), en español y de código abierto, para aprender a leer partituras
y a tocar el piano: solfeo, claves, notas, figuras, compases, armaduras y todos los símbolos
de la partitura, con ejercicios de práctica y una biblioteca de partituras personales.

- **Cuentas de usuario**: registro con correo y contraseña. El progreso de práctica se guarda en
  el servidor (Postgres) y se ve igual en todos los dispositivos. Sin cuenta la app funciona
  igual, con el progreso solo en el dispositivo; al entrar, ese progreso se suma a la cuenta.
- Funciona sin conexión una vez instalada: las respuestas se encolan y se envían cuando hay red.
- Las partituras (PDF / MusicXML), con sus anotaciones y notas, se guardan en el dispositivo (IndexedDB)
  y, con cuenta, también en el servidor: se abren desde cualquier dispositivo y se sincronizan al entrar.
- Símbolos musicales con las fuentes originales del estándar SMuFL (Bravura) y notación con VexFlow.
- **Plan de estudio con IA** para cada partitura: análisis (tonalidad, escala que dominar, tempo, forma),
  qué practicar antes (enlazado a las lecciones y ejercicios de la app), objetivos progresivos por compases
  con digitaciones y consejos, rutina semanal, seguimiento de objetivos y un chat con el «profesor».
  Funciona con la clave de API del propio usuario (ChatGPT / OpenAI o Claude / Anthropic).
- **Transcripción de un PDF a MusicXML**, por dos caminos: el **reconocimiento automático** (OMR) de un
  servicio propio, gratis para el usuario y sin claves, y un **modelo de visión** con la clave del propio
  usuario, que lee mejor lo apretado pero se paga por página. En los dos casos es un borrador —el ritmo es
  donde más se falla—, así que se comprueba compás a compás que las figuras sumen lo que pide el compás y
  se señalan los que no.

## Arquitectura

| Servicio | Qué es | Imagen |
| --- | --- | --- |
| `web` | Next.js 16 (salida *standalone*) + Prisma. Sirve la app y la API (`/api/auth/*`, `/api/progress`, `/api/scores`, `/api/health`). Los archivos de las partituras van al volumen `scores` (en streaming, sin cargarlos en memoria); cuota por usuario `SCORES_QUOTA_MB` (300 por defecto). | `ghcr.io/<usuario>/opus-piano-web` |
| `db` | PostgreSQL 16 (alpine), ajustado para poca RAM. Guarda usuarios, sesiones, progreso y los metadatos de las partituras (nombre, notas, trazos, miniatura). | `postgres:16-alpine` |
| `omr` | **Fuera del VPS.** Reconocimiento óptico de partituras (oemer sobre FastAPI, ver [`omr-service/`](omr-service/)): recibe la imagen de una página y devuelve su MusicXML. Necesita 4 GB y la CPU entera durante minutos, así que va en Cloud Run, que lo apaga cuando nadie lo usa. Opcional: sin `OMR_URL`, la app no ofrece la opción. | se construye en `omr-service/` |

Autenticación propia y ligera: contraseñas con **scrypt** (Node, sin dependencias nativas),
sesiones en base de datos con cookie `HttpOnly` + `SameSite=Lax`, comprobación de origen en las
peticiones que escriben, y límite de intentos en login/registro. Los formularios se validan con
**zod** con los mismos esquemas en cliente y servidor. Opcionalmente, **Google** (OAuth / OpenID
Connect con [arctic](https://arcticjs.dev)): el botón solo aparece si hay credenciales configuradas,
y la identidad de Google se vincula a la cuenta que ya tenga ese correo.

Consumo en el VPS: `web` ≈ 120–180 MB, `db` ≈ 30–60 MB. Los límites del compose son 384 MB y
256 MB respectivamente; el heap de Node está topado a 256 MB.

## Desarrollo local

Requiere [bun](https://bun.sh) 1.3+ y Docker (solo para Postgres).

```bash
cp .env.example .env                 # ajusta POSTGRES_PASSWORD y DATABASE_URL
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
bun install
bunx prisma migrate dev              # crea las tablas
bun run dev                          # http://localhost:3000
```

### Comprobaciones

```bash
bun run lint              # ESLint
bun run typecheck         # tsc (src + tests)
bun run test              # unitarios: contraseñas, cookies, validación zod, rate limit, progreso
bun run test:integration  # contra Postgres (DATABASE_URL): registro → sesión → progreso → borrado
bun run build             # build de producción (genera sw.js y salida standalone)
```

Los tests de integración necesitan una base de datos vacía o de pruebas: usan las rutas de la
API directamente (sin levantar el servidor) y limpian las cuentas `@opus.test` al terminar.

### Probar la imagen final en Docker

El día a día es `bun run dev` (recarga en caliente). Esto otro levanta lo mismo que corre en el
VPS —la imagen de producción más Postgres— para comprobar el build standalone, las migraciones
al arrancar o el healthcheck antes de desplegar.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
curl localhost:3001/api/health       # {"ok":true} cuando la base de datos responde
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f web
docker compose -f docker-compose.yml -f docker-compose.dev.yml down          # parar (los datos siguen)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v       # parar y borrar datos
```

`WEB_PORT` y `DB_PORT` (en `.env`) eligen los puertos publicados; por defecto 3000 y 5432, que
en local suele ocupar ya otro proyecto. `SITE_URL` se incrusta al compilar (canónicas, sitemap,
Open Graph), así que debe coincidir con `WEB_PORT`; al cambiarlo hay que reconstruir (`--build`).

Ojo con dos diferencias frente a `bun run dev`: al ser `NODE_ENV=production` la cookie de sesión
lleva `Secure`, que los navegadores solo aceptan en `localhost` (por la IP de la red local el
login no funciona); y el código va compilado, así que cada cambio necesita `--build`.

## Instalación en un VPS (Hostinger + Dokploy)

La idea: **GitHub construye, el VPS solo descarga**. Compilar Next.js en un VPS de 1–2 GB se
queda sin memoria; por eso `deploy.yml` construye la imagen en GitHub Actions, la publica en
GitHub Container Registry (ghcr.io) y avisa a Dokploy, que hace `pull` y reinicia.

### 1. Repositorio y paquetes en GitHub

1. Sube el código a GitHub (`main` es la rama que despliega).
2. Tras el primer push a `main`, el workflow **Deploy** publica `ghcr.io/<usuario>/opus-piano-web`.
3. Haz público el paquete (GitHub → tu perfil → *Packages* → el paquete → *Package settings* →
   *Change visibility*), o bien configura en Dokploy un registro privado (*Settings → Registry*) con un
   token clásico de GitHub con permiso `read:packages`. Con el paquete público no hace falta nada.

   Si tu usuario no es `snthz`, cambia el valor por defecto de `WEB_IMAGE` en `docker-compose.yml`,
   o defínelo como variable de entorno en Dokploy.

### 2. Servidor

- VPS con Ubuntu y **al menos 1 GB de RAM** (2 GB recomendados; Dokploy en sí usa ~300–500 MB).
- Instala Dokploy: `curl -sSL https://dokploy.com/install.sh | sh` y entra en `http://IP:3000`.
- Apunta tu dominio (registro A) a la IP del VPS.

### 3. Servicio en Dokploy

1. **Projects → Create project** y dentro **Create service → Compose**.
2. *Provider*: GitHub (o Git con la URL pública). Rama `main`, *Compose path* `./docker-compose.yml`.
3. **Environment**: la única variable obligatoria es la contraseña de Postgres.

   ```
   POSTGRES_PASSWORD=una-contraseña-larga-y-aleatoria
   ```

   Opcionales: `WEB_PORT` (puerto publicado, 3000 por defecto), `WEB_MEMORY`, `DB_MEMORY`, `WEB_IMAGE`,
   `SCORES_QUOTA_MB` (espacio de partituras por usuario).

   Para el botón de Google añade también `APP_URL=https://tu-dominio`, `GOOGLE_CLIENT_ID` y
   `GOOGLE_CLIENT_SECRET` (ver `.env.example`): en Google Cloud, un *ID de cliente OAuth* de aplicación
   web con URI de redirección `https://tu-dominio/api/auth/oauth/google/callback`. Sin esas variables el
   botón no se muestra.
4. **Domains**: añade tu dominio al servicio `web`, puerto `3000`, HTTPS con Let's Encrypt.
5. **Deployments → Webhook URL**: copia la URL y guárdala en GitHub como secreto
   `DOKPLOY_WEBHOOK_URL` (*Settings → Secrets and variables → Actions*). Es lo que usa el
   workflow para avisar a Dokploy al terminar. Sin el secreto, el workflow publica las imágenes
   y avisa de que falta; puedes pulsar *Deploy* en Dokploy a mano.
6. Pulsa **Deploy** una vez. Al arrancar, `web` aplica las migraciones de Prisma
   (`prisma migrate deploy`) y luego sirve la app. Comprueba `https://tu-dominio/api/health`.

A partir de ahí, cada push a `main` pasa por lint, tipos, tests unitarios, tests de integración
con Postgres y build; si todo va bien, publica la imagen y Dokploy la despliega en uno o dos
minutos. Un PR o una rama solo ejecutan **CI**, sin desplegar.

### Copias de seguridad

El estado vive en dos volúmenes: `pgdata` (base de datos) y `scores` (archivos de las partituras).

```bash
docker exec $(docker ps -qf name=db) pg_dump -U opus opus | gzip > opus-$(date +%F).sql.gz
docker run --rm -v $(docker volume ls -qf name=scores):/data -v $PWD:/out alpine tar czf /out/scores-$(date +%F).tgz -C /data .
```

Dokploy también ofrece copias programadas a S3 en el servicio `db`.

## Plan de estudio con IA

No hay ninguna clave de IA en el servidor: cada usuario pone la suya en **Ajustes → Plan de estudio con IA**
(proveedor, clave y modelo). La clave se guarda solo en su navegador (`localStorage`) y las peticiones salen
directamente del navegador a `api.openai.com` o `api.anthropic.com`; el servidor de Opus Piano nunca la ve.
El coste lo paga el usuario al proveedor: un plan suele costar céntimos (se muestra una estimación por modelo).

Cómo funciona (todo en [`src/lib/ai/`](src/lib/ai/) y [`src/lib/study-plan.ts`](src/lib/study-plan.ts)):

- **Qué ve el modelo**: si la partitura es MusicXML (o un PDF con MusicXML vinculado), un resumen textual
  nota a nota compás por compás (`summarizeScore`). Si es PDF, las primeras 12 páginas dibujadas en PNG al
  lado largo que cada modelo procesa sin reescalar (`maxImageEdge`). Además, nivel, tiempo disponible y
  objetivo personal del alumno y sus notas.
- **Salida estructurada**: el plan se pide como JSON con un esquema (`STUDY_PLAN_SCHEMA`, descrito una sola
  vez y emitido en la variante que exige cada proveedor) y se valida con zod antes de guardarlo.
- **Dónde se guarda**: con la partitura, en IndexedDB y, con cuenta, en la columna `Score.plan` del servidor,
  sincronizado igual que las notas y los trazos (gana el `updatedAt` más reciente). El servidor solo valida su
  forma (`planStateSchema`).
- **Chat**: «Pregunta al profesor» envía el plan, el resumen de la partitura y los últimos 12 turnos; la
  respuesta llega en streaming. El historial del chat no se guarda.
- **Modelos**: el catálogo con estrellas (rapidez, precisión, economía), precios y el «recomendado» de cada
  proveedor está en [`src/lib/ai/models.ts`](src/lib/ai/models.ts). También se puede escribir cualquier otro id.

### Transcribir un PDF a MusicXML

Un PDF es solo una imagen: sin MusicXML no se puede tocar la pieza ni mostrar los nombres. Desde el lector,
«Transcribir con IA» manda cada página al modelo y monta el archivo ([`src/lib/ai/transcribe.ts`](src/lib/ai/transcribe.ts)
y [`src/lib/music/musicxml-build.ts`](src/lib/music/musicxml-build.ts)).

- **El modelo no escribe XML.** Devuelve JSON con esquema estricto donde cada pentagrama de cada compás es una
  línea en la notación compacta de la app (`C4/q (D4 G4)/h~ r/8`), la misma que `summarizeScore` usa para
  contarle al modelo lo que hay en un MusicXML. Ocupa una fracción de los tokens del XML equivalente, el
  archivo sale siempre bien formado porque lo escribe la app, y se puede comprobar antes de guardarlo.
- **Lo que se comprueba**: que las figuras de cada compás sumen lo que pide el compás (`checkDurations`; la
  anacrusa y el compás final pueden ser cortos). Los que no cuadran se listan en el panel: casi siempre son
  una figura mal leída, y descolocan la reproducción a partir de ahí.
- **Qué sale**: una parte de piano con uno o dos pentagramas y una voz por pentagrama —lo que Opus Piano sabe
  dibujar y tocar—, con acordes, silencios, puntillos, ligaduras de unión y las alteraciones impresas
  calculadas a partir de la armadura. Se puede vincular a la partitura o descargar para arreglarlo en MuseScore.
- **Límites**: 6 páginas por transcripción, una petición por página, y cuesta bastante más que un plan de
  estudio (se muestra la estimación). Para una transcripción fiable, el MusicXML de MuseScore sigue siendo mejor.

### Reconocer la partitura sin IA (OMR)

El mismo panel ofrece antes otra vía: **reconocimiento automático**, gratis y sin claves. El navegador
dibuja cada página, la manda a `/api/omr` y el servidor se la pasa al servicio de
[`omr-service/`](omr-service/) —[oemer](https://github.com/BreezeWhite/oemer), modelos de OMR ya
entrenados— que devuelve el MusicXML de esa página. La app lo lee con su propio lector, pega las páginas
(`src/lib/omr/merge.ts`) y lo vuelve a escribir con su escritor, así que lo que se guarda es el mismo
dialecto de siempre: una parte de piano, uno o dos pentagramas, una voz por pentagrama.

- **Hace falta cuenta.** Aquí la CPU la paga el servidor, no el usuario con su clave: se exige sesión y hay
  un límite de `OMR_PAGES_PER_HOUR` páginas por hora y usuario. Sin `OMR_URL` configurada, la opción no
  aparece y la transcripción con IA sigue funcionando igual (esa sí, sin cuenta).
- **Tarda minutos por página**, así que la petición devuelve un flujo de líneas JSON con señales de vida y
  la tarea corre en segundo plano como las demás: se puede cerrar el panel y seguir leyendo.
- **Se le da bien lo impreso y aireado**, y mal lo denso, lo torcido y lo manuscrito; cuando no puede,
  lo dice. Para partituras apretadas, el modelo de visión llega más lejos.
- Detalles del servicio, contrato HTTP, despliegue y lo que consume: [`omr-service/README.md`](omr-service/README.md).

## SEO

El dominio público se lee de la variable `SITE_URL` (`https://opuspiano.app` por defecto).
Es una variable **de compilación**: las páginas se prerenderizan y con ellas las URL canónicas,
el sitemap y las etiquetas Open Graph. Se pasa como `ARG SITE_URL` al construir la imagen
(en GitHub Actions, con la variable de repositorio `SITE_URL`).

Todo lo relacionado está en [`src/lib/seo.ts`](src/lib/seo.ts): descripción, palabras clave,
el helper `pageMetadata()` que cada página usa para su título, su descripción y su canónica,
y los generadores de datos estructurados (JSON-LD).

| Ruta | Qué es |
| --- | --- |
| `/sitemap.xml` | Se genera solo desde los datos: lecciones, ejercicios, símbolos y glosario. |
| `/robots.txt` | Bloquea `/api/`, `/scores`, `/settings`, `/account` y `/offline`. |
| `/opengraph-image` | Imagen de 1200×630 para compartir, dibujada con `next/og`. |
| `/guide` | Página pilar: la guía larga desde la que salen enlaces a cada lección. |
| `/glossary/[term]` | Una ficha por término del glosario (búsquedas de cola larga). |
| `/symbols` y `/symbols/[category]` | Diccionario de símbolos por familias. |
| `/faq` | Preguntas frecuentes, con marcado `FAQPage`. |

Al añadir una página nueva: exporta su `metadata` con `pageMetadata()` y añádela a
`src/app/sitemap.ts`. Las páginas con datos del usuario llevan `noindex: true`.

## Plan de desarrollo

Ver [PLAN.md](./PLAN.md).

## Licencia

Código bajo licencia [MIT](./LICENSE). Las fuentes Bravura, Bravura Text y Academico
(Steinberg Media Technologies) se distribuyen bajo la SIL Open Font License 1.1.
