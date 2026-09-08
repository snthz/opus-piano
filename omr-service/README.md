# Servicio de OMR de Opus Piano

Reconocimiento óptico de partituras: recibe la imagen de **una página** y devuelve su **MusicXML**.
Por dentro es [oemer](https://github.com/BreezeWhite/oemer) (modelos ONNX ya entrenados, solo CPU)
detrás de FastAPI. No se entrena nada.

Va en un contenedor aparte de la aplicación porque necesita ~5 GB de memoria y la CPU entera
durante minutos por página: en el VPS donde vive Opus Piano (con 384 MB para la web y 256 MB para
Postgres) no cabe, y tenerlo encendido todo el día para lo poco que se usa no tiene sentido. En
Cloud Run se apaga solo cuando nadie lo llama.

## Contrato

El formato de salida es MusicXML, no un JSON propio: la aplicación ya lee MusicXML para dibujar y
tocar una partitura, así que cualquier formato intermedio sería una traducción más que mantener a
los dos lados.

### `POST /v1/transcribe`

- `multipart/form-data` con el campo `file`: PNG, JPEG o PDF (de un PDF se lee la primera página).
- `Authorization: Bearer <OMR_TOKEN>` si el servicio se desplegó con token.
- Responde cuando ha terminado; **no hay identificadores de trabajo ni sondeo**. Un servicio que
  escala a cero y atiende una petición por instancia no puede guardar el estado en memoria y
  esperar a que el sondeo caiga en la misma instancia. La espera la sostiene quien llama.

```json
{
  "musicxml": "<?xml version=\"1.0\"…",
  "seconds": 214.3,
  "image": { "width": 1654, "height": 2339, "source": "pdf", "resized": false },
  "engine": "oemer (Opus Piano OMR 1.0.0)"
}
```

Los errores llevan su código y su estado:

```json
{ "error": { "code": "EMPTY_SCORE", "message": "No staves were found in the image" } }
```

| Código | Estado | Cuándo |
| --- | --- | --- |
| `UNSUPPORTED_TYPE` | 415 | Los bytes no son PNG, JPEG ni PDF (no se mira la extensión) |
| `TOO_LARGE` | 413 | Por encima de `OMR_MAX_UPLOAD_MB` |
| `IMAGE_TOO_SMALL` | 422 | Menos de `OMR_MIN_WIDTH` px de ancho |
| `BAD_PDF` | 422 | PDF cifrado, roto o sin páginas |
| `EMPTY_SCORE` | 422 | No ha encontrado pentagramas ni notas |
| `OMR_TIMEOUT` | 504 | Se ha pasado de `OMR_TIMEOUT` segundos |
| `OMR_FAILED` | 502 | oemer se ha roto por dentro (pasa) |
| `BUSY` | 503 | La instancia ya está con otra página. Ojo: un 503 **sin** este cuerpo JSON viene de Cloud Run y quiere decir que la instancia se murió (la aplicación lo traduce como `CRASHED`, no como «ocupado») |
| `UNAUTHORIZED` | 401 | Falta el token o no coincide |

Los mensajes van en inglés y sin detalles internos: quien los traduce y los enseña es la
aplicación, en `src/lib/server/omr.ts`.

### `GET /health`

`{"status":"ok","version":"1.0.0"}`. No carga modelos ni toca el disco.

Responde igual en `/healthz`, pero **en Cloud Run esa ruta no llega**: el frontend de Google la
atrapa y devuelve su propio 404 en HTML. Para comprobar el servicio desplegado, `/health`.

## Variables

| Variable | Por defecto | Qué hace |
| --- | --- | --- |
| `PORT` | 8080 | Puerto de escucha (Cloud Run la inyecta) |
| `OMR_TOKEN` | — | Si está, se exige `Authorization: Bearer` |
| `OMR_TIMEOUT` | 600 | Corte duro del reconocimiento, en segundos |
| `OMR_MAX_UPLOAD_MB` | 10 | Tamaño máximo del archivo |
| `OMR_MAX_WIDTH` | 2000 | Ancho al que se reduce la imagen |
| `OMR_MIN_WIDTH` | 600 | Por debajo, se rechaza |
| `OMR_PDF_DPI` | 200 | Resolución al rasterizar un PDF |
| `OMR_THREADS` | 0 | Hilos de la inferencia; 0 los deja a criterio de onnxruntime, que dentro de un contenedor cuenta los núcleos del anfitrión. En Cloud Run, el número de vCPU |

## En local

```bash
scripts/local_run.sh                 # crea .venv, baja los modelos (110 MB) y levanta el 8000
curl localhost:8000/health
curl -F file=@tests/fixtures/bach-wtk1-prelude1.pdf localhost:8000/v1/transcribe
```

Tests (no llaman a oemer: tardarían minutos y lo que se prueba es el contrato):

```bash
./.venv/bin/python -m pytest tests -q
```

## Despliegue en Cloud Run

```bash
OMR_TOKEN=$(openssl rand -hex 24) scripts/deploy.sh
```

Y en el `.env` de Opus Piano, `OMR_URL=https://…` y el mismo `OMR_TOKEN`.

El servicio se despliega público (`--allow-unauthenticated`) porque quien llama es el servidor de
la aplicación, no un usuario con identidad de Google; el token es lo que lo cierra. La aplicación,
además, solo deja usarlo con la sesión iniciada y con un límite de páginas por hora.

**Pon una alerta de presupuesto de 1 USD** en la facturación de Google antes de dejarlo abierto:
`--max-instances` limita cuántas instancias hay a la vez, no cuántas horas se acumulan.

### Lo que cuesta de verdad

Medido con `tests/fixtures/bach-wtk1-prelude1.pdf` (una página A4, dos pentagramas, semicorcheas
seguidas), en el propio servicio desplegado con `--cpu 4 --memory 6Gi`:

| | |
| --- | --- |
| Tiempo de reloj | **7 min** por página |
| CPU | 1,5 vCPU de media (38 % de las cuatro); solo la inferencia se reparte, el resto de oemer es de un hilo |
| Memoria máxima | **~4,5 GB** |

Cuidado con la métrica `memory/utilizations` de Cloud Run para dimensionar: es la **media de cada
minuto**, no el pico. Marcaba un 49 % de 6 GiB —2,9 GB— y con ese dato se probó a bajar el límite a
4 GiB; la primera página tumbó la instancia con «Memory limit of 4096 MiB exceeded with 4456 MiB
used». El pico real está donde lo ponía la medición local, en torno a 4,5 GB.

oemer reescala por dentro a unos 3,6 millones de píxeles pase lo que pase, así que mandar la
imagen más pequeña **no** baja la memoria: baja la calidad y deja el gasto igual.

Con esos números, el nivel gratuito de Cloud Run (180.000 vCPU-s y 360.000 GiB-s al mes) da para
unas **100 páginas al mes** —manda la CPU, no la memoria—, y una página que se pase de ahí cuesta
unos 5 céntimos. No es «coste cero» pero sí «coste de bolsillo», siempre que la alerta de
presupuesto esté puesta.

### Qué se puede esperar del resultado

De esa misma página, con las notas contadas a mano:

- **Las alturas salen bien.** El compás 1 de la mano derecha sale «G4 C5 E5» repetido, que es lo
  que hay impreso; la armadura, las claves y los dos pentagramas también.
- **El ritmo no.** De los 36 pentagramas-compás de la página, 7 suman lo que pide el compás. Con
  una partitura tan apretada, oemer reparte mal las figuras, y un compás que no cuadra descoloca la
  reproducción a partir de ahí.
- La aplicación no lo esconde: enseña los 30 avisos, uno por compás que no suma, y deja descargar
  el archivo para arreglarlo en MuseScore.

Sirve, entonces, para **ver los nombres de las notas y tener el esqueleto**, no para una
reproducción fiel. Para eso están el MusicXML de MuseScore o el modelo de visión.

## Límites conocidos

- **oemer se rompe con cierta facilidad.** Es código de 2022 sin mantenimiento al día y revienta por
  dentro con páginas que no le cuadran. Por eso las versiones de `requirements.txt` van fijas: con
  OpenCV 5, sin ir más lejos, falla siempre al buscar los pentagramas (`HoughLinesP` devuelve las
  líneas con otra forma). Cuando se rompe, el servicio recoge la traza, la registra y responde
  `OMR_FAILED`; nunca sale hacia el usuario.
- Solo partituras **impresas**. Manuscritas no; oemer no está entrenado para eso.
- De un PDF, solo la primera página. La aplicación no lo nota: dibuja cada página por su cuenta y
  manda una imagen por petición.
- Sin dinámicas, articulaciones, adornos ni letra: se queda en notas, silencios, figuras,
  alteraciones y compases.
- oemer no detecta el compás (`<time>`): la aplicación asume 4/4 mientras no diga otra cosa.
- Los silencios de relleno que oemer intercala para colocar sus voces se quitan antes de responder
  (`app/musicxml_clean.py`); si no, aparecerían dibujados en la partitura.
