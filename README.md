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
- **La app escucha lo que tocas**, no solo lo que pulsas en la pantalla:
  - **Teclado MIDI** (Web MIDI, donde el navegador lo admita): responde a los ejercicios tocando las
    teclas, y en el **modo espera** la partitura no avanza hasta que tocas lo que hay escrito (con una
    mano callada, esa la tocas tú y la app pone la otra).
  - **Micrófono**: el ejercicio de ritmo se marca con palmas y el de solfeo se canta y se corrige nota
    a nota, ignorando la octava. No se graba ni se envía nada: cada fragmento se mide y se descarta.
- **Ensayar, no solo escuchar**: repetir unos compases en bucle, callar una mano, cuenta atrás y subir
  el tempo unos bpm en cada vuelta.
- **Práctica adaptativa**: cada nota, armadura, símbolo o intervalo lleva su ficha y su caja de repaso
  espaciado; lo que fallas vuelve a salir antes y lo que ya sabes se aparta. En `/practice` se ve qué se
  te resiste. Estas fichas se quedan en el dispositivo: son el cuaderno del ejercicio, no un resultado.
- **Plan de estudio con IA** para cada partitura: análisis (tonalidad, escala que dominar, tempo, forma),
  qué practicar antes (enlazado a las lecciones y ejercicios de la app), objetivos progresivos por compases
  con digitaciones y consejos, rutina semanal, seguimiento de objetivos y un chat con el «profesor».
  Lo prepara Claude con la clave de API del servidor: el usuario no configura ni paga nada, solo necesita cuenta.
  **El plan se corrige solo**: al terminar cada sesión se pregunta cómo ha ido, y un objetivo que cuesta gana
  otra sesión (el resto del calendario se corre con él) mientras que uno conseguido libera las que le quedaban.
- **Las sesiones, en el calendario del móvil** (`.ics`, con aviso diez minutos antes): es lo que avisa con la
  app cerrada y sin conexión, sin montar notificaciones push.
- **Catálogo de dominio público** (`/scores/catalog`): 21 piezas en MusicXML de bibliotecas de dominio
  público (Für Elise, el preludio BWV 846, Clementi, Satie, Chopin, Joplin… y cuatro arreglos fáciles de las
  mismas bibliotecas para empezar), ordenadas por nivel, cada una con un análisis breve de cómo abordarla.
  Aquí no se escribe ninguna partitura a mano. Cada ficha enseña **la partitura original entera**, grabada
  con Verovio página a página, y suena antes de guardarla. Los archivos van en `public/catalog/` y sus
  portadas, ya hechas, en `public/catalog/covers/`.
- **Partituras compartidas**: cada partitura de la biblioteca puede ser privada, visible por enlace o pública
  (`/scores/community`). Se comparten el archivo, el nombre, la portada y una presentación; las notas, los
  trazos y el análisis siguen siendo privados. Quien la ve puede guardarse una copia.
- **Ruta de aprendizaje** (`/path`) que ordena lecciones, ejercicios y piezas, y un **profesor general**
  (`/teacher`) que responde dudas de música citando las páginas de la app.
- **Techo de gasto** para la IA: `AI_MONTHLY_BUDGET_USD` corta las llamadas al modelo cuando el mes llega al
  presupuesto; los límites por usuario se cuentan en Postgres (`AiCall`) y sobreviven a los despliegues.
- **Transcripción de un PDF a MusicXML** con el **reconocimiento automático** (OMR) de un servicio propio,
  gratis para el usuario y sin claves. Es un borrador —el ritmo es donde más se falla—, así que se comprueba
  compás a compás que las figuras sumen lo que pide el compás y se señalan los que no.

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

Un script aparte, que no entra en el build porque su resultado se sube al repositorio:

```bash
bun run gen:covers        # portadas del catálogo: la primera página de cada .mxl, grabada, a JPEG
```

Lee `public/catalog/*.mxl`, graba la primera página con Verovio y la escribe en
`public/catalog/covers/<id>.jpg`; solo hace las que falten (`--force` las rehace todas). Necesita Chrome
o Brave instalados para pasar el SVG a JPEG. Al añadir una pieza al catálogo hay que ejecutarlo y
subir la portada nueva.

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

   Para el plan de estudio con IA, `ANTHROPIC_API_KEY` (la clave del servidor; el usuario no pone
   ninguna) y, si quieres cambiarlos, `STUDY_PLAN_MODEL`, `PLANS_PER_DAY` y `PLAN_QUESTIONS_PER_HOUR`.
   Sin la clave, la app no ofrece la opción y todo lo demás funciona igual.

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

Lo prepara Claude con **la clave de API del servidor** (`ANTHROPIC_API_KEY`): el alumno no configura ni paga
nada. Como el gasto es del servidor, hace falta cuenta y hay un tope de `PLANS_PER_DAY` planes por usuario y
día (3 por defecto) y `PLAN_QUESTIONS_PER_HOUR` preguntas al profesor por hora. Sin la clave, `/api/study-plan`
responde `{ enabled: false }` y la app no ofrece la opción.

El reparto: [`src/lib/study-plan.ts`](src/lib/study-plan.ts) es lo compartido (esquema del plan, resumen de la
partitura e instrucciones), [`src/lib/plan/client.ts`](src/lib/plan/client.ts) el navegador,
[`src/lib/server/study-plan.ts`](src/lib/server/study-plan.ts) la llamada al modelo.

- **Modelo**: `claude-sonnet-5` por defecto (`STUDY_PLAN_MODEL`). Lee bien una partitura escaneada y cuesta
  una fracción de lo que cuesta Opus; Haiku es más barato pero se le escapan alteraciones y figuras. Un plan
  ronda los 10-15 céntimos.
- **Qué ve el modelo**: si la partitura es MusicXML (o un PDF con MusicXML vinculado), un resumen textual
  nota a nota compás por compás (`summarizeScore`). Si es PDF, las primeras 12 páginas dibujadas en PNG a
  1568 px de lado largo (`PAGE_EDGE`): las imágenes son la mayor parte del coste y a esa resolución una A4
  sale por unos 2300 tokens. Además, nivel, tiempo disponible y objetivo personal del alumno y sus notas.
- **Salida estructurada**: el plan se pide como JSON con un esquema estricto (`STUDY_PLAN_SCHEMA`) y se valida
  con zod en el servidor antes de devolverlo, porque el esquema de la API no puede comprobar que las lecciones
  enlazadas existan. Las instrucciones y las descripciones del esquema piden un plan **condensado**: frases
  cortas, de 5 a 9 objetivos y nada de relleno.
- **Respuesta en flujo**: un plan tarda uno o dos minutos, así que `/api/study-plan` devuelve líneas JSON con
  señales de vida y la tarea corre en segundo plano: se puede cerrar el panel y seguir
  leyendo la partitura.
- **Dónde se guarda**: con la partitura, en IndexedDB y, con cuenta, en la columna `Score.plan` del servidor,
  sincronizado igual que las notas y los trazos (gana el `updatedAt` más reciente).
- **Chat**: «Pregunta al profesor» (`/api/study-plan/ask`) envía el plan, el resumen de la partitura, cómo han
  ido las sesiones y los últimos 12 turnos; la respuesta llega palabra a palabra. La conversación se guarda en
  el dispositivo (una por partitura, y otra para el profesor general), así que sigue donde se dejó; no se
  sincroniza con la cuenta.

### Transcribir un PDF a MusicXML (OMR)

Un PDF es solo una imagen: sin MusicXML no se puede tocar la pieza ni mostrar los nombres. El navegador
dibuja cada página del PDF y las sube todas de una vez a `/api/transcriptions`; a partir de ahí el trabajo
es del servidor, que pasa cada página por el servicio de [`omr-service/`](omr-service/)
—[oemer](https://github.com/BreezeWhite/oemer), modelos de OMR ya entrenados— y guarda su MusicXML. Al
recogerlo, la app lo lee con su propio lector, pega las páginas (`src/lib/omr/merge.ts`) y lo vuelve a
escribir con su escritor, así que lo que se guarda es el mismo dialecto de siempre: una parte de piano, uno
o dos pentagramas, una voz por pentagrama.

- **Es un encargo, no una petición.** El estado vive en la tabla `Transcription` y las páginas en disco
  (`SCORES_DIR/<userId>/omr/<id>/`). **Cerrar la pestaña no lo para**: al volver a la biblioteca,
  `use-resume-transcriptions.ts` pregunta qué hay en marcha y lo vuelve a enganchar a su partitura. Lo único
  que lo para es cancelarlo a mano, que además borra las páginas (`DELETE /api/transcriptions/<id>`, el
  mismo que se usa al recoger el resultado).
- **Uno cada vez por usuario**, porque el servicio atiende una partitura a la vez; encargar otro mientras
  hay uno vivo devuelve 409. El trabajo late cada 20 s en la fila, así que un reinicio del servidor a medias
  se detecta y el encargo se marca como fallido en vez de quedarse colgado.
- **Hace falta cuenta.** La CPU la paga el servidor: se exige sesión y hay un límite de `OMR_PAGES_PER_HOUR`
  páginas por hora y usuario. Sin `OMR_URL` configurada, la opción no aparece.
- **Se le da bien lo impreso y aireado**, y mal lo denso, lo torcido y lo manuscrito; cuando no puede,
  lo dice. Para partituras apretadas o manuscritas sigue siendo mejor el MusicXML de MuseScore.
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
