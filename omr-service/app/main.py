"""
Servicio HTTP de reconocimiento óptico de partituras (OMR).

Recibe la imagen de una página y devuelve su MusicXML. El contrato es MusicXML
y no un JSON propio a propósito: Opus Piano ya lee MusicXML para dibujar y
tocar una partitura, y un formato intermedio solo añadiría una traducción más
que mantener a los dos lados.

Una petición, una página, y se responde cuando está: nada de identificadores de
trabajo. El estado en memoria de un servicio que escala a cero y atiende una
petición por instancia no se puede consultar después —el sondeo cae en otra
instancia y no encuentra nada—, así que la espera la sostiene la aplicación,
que ya enseña su propio anillo de progreso.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import sys
import tempfile
import threading
import time
from typing import Optional

from fastapi import Depends, FastAPI, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from . import config
from .errors import Busy, OmrError, TooLarge, Unauthorized
from .omr import run_omr
from .preprocess import normalize

VERSION = "1.0.0"

app = FastAPI(title="Opus Piano OMR", version=VERSION, docs_url=None, redoc_url=None)
log = logging.getLogger("omr")

#: Una página a la vez por instancia: oemer se come la CPU entera y dos a la
#: vez tardan más que dos seguidas. Quien llegue mientras tanto recibe 503 y
#: Cloud Run levanta otra instancia.
_slot = threading.Semaphore(1)


def _check_token(request: Request) -> None:
    if not config.TOKEN:
        return
    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""
    # Comparación en tiempo constante: el token es corto y el servicio, público.
    if not token or not _equal(token, config.TOKEN):
        raise Unauthorized("Missing or invalid token")


def _equal(a: str, b: str) -> bool:
    import hmac

    return hmac.compare_digest(a.encode(), b.encode())


@app.get("/health")
@app.get("/healthz")
async def health() -> dict:
    """
    Comprobación de vida: no toca los modelos ni el disco.

    Dos rutas para lo mismo porque en Cloud Run `/healthz` no llega hasta aquí
    —lo atrapa el frontend de Google y devuelve su propio 404—, así que la que
    sirve de verdad ahí fuera es `/health`.
    """
    return {"status": "ok", "version": VERSION}


@app.post("/v1/transcribe", dependencies=[Depends(_check_token)])
async def transcribe(file: UploadFile, dewarp: Optional[bool] = Form(default=None)) -> JSONResponse:
    """
    `dewarp` enciende el enderezado profundo de oemer para esta página: cuesta
    minutos y solo hace falta con una página curvada (la foto de un libro
    grueso). La inclinación normal ya se corrige antes, al normalizar.
    """
    # El token se comprueba como dependencia, antes de que FastAPI se ponga a
    # leer el multipart: quien no se identifica no llega ni a subir el archivo.

    # Un byte más del límite para distinguir «justo en el límite» de «se pasa».
    data = await file.read(config.MAX_UPLOAD_BYTES + 1)
    if len(data) > config.MAX_UPLOAD_BYTES:
        raise TooLarge(f"The file is larger than {config.MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    # Un archivo vacío ni siquiera tiene tipo: lo rechaza `sniff` con 415.

    if not _slot.acquire(blocking=False):
        raise Busy("Another page is being processed")
    try:
        return await run_in_threadpool(_process, data, dewarp)
    finally:
        _slot.release()


def _process(data: bytes, dewarp: Optional[bool] = None) -> JSONResponse:
    started = time.monotonic()
    workdir = tempfile.mkdtemp(prefix="omr-")
    try:
        image = normalize(data, workdir)
        result = run_omr(image.path, workdir, dewarp=dewarp)
        log.info(
            "page recognised",
            extra={
                "source": image.source,
                "width": image.width,
                "height": image.height,
                "rotated": image.rotated,
                "dewarp": config.DEWARP if dewarp is None else dewarp,
                "omr_seconds": round(result.seconds, 1),
                "total_seconds": round(time.monotonic() - started, 1),
                "bytes": len(data),
            },
        )
        return JSONResponse(
            {
                "musicxml": result.musicxml,
                "seconds": round(result.seconds, 1),
                "image": {
                    "width": image.width,
                    "height": image.height,
                    "source": image.source,
                    "resized": image.resized,
                    "rotated": image.rotated,
                },
                "engine": f"oemer (Opus Piano OMR {VERSION})",
            }
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


@app.exception_handler(OmrError)
async def _omr_error(_: Request, exc: OmrError) -> JSONResponse:
    return JSONResponse({"error": {"code": exc.code, "message": exc.message}}, status_code=exc.status)


@app.exception_handler(Exception)
async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
    log.exception("unexpected error: %s", exc)
    return JSONResponse({"error": {"code": "INTERNAL", "message": "Unexpected error"}}, status_code=500)


class _JsonFormatter(logging.Formatter):
    """Una línea JSON por registro, que es lo que Cloud Run sabe indexar."""

    _SKIP = frozenset(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {"message", "asctime", "taskName"}

    def format(self, record: logging.LogRecord) -> str:
        entry = {"severity": record.levelname, "message": record.getMessage(), "logger": record.name}
        for key, value in record.__dict__.items():
            if key not in self._SKIP:
                entry[key] = value
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        # default=str: en los registros de acceso de uvicorn viaja el «scope» de
        # la petición, que no es serializable; antes de perder la línea entera,
        # se escribe como texto.
        return json.dumps(entry, ensure_ascii=False, default=str)


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(os.environ.get("OMR_LOG_LEVEL", "INFO"))
    # uvicorn se monta sus propios manejadores antes de importar la aplicación;
    # se los quitamos para que sus líneas salgan por el mismo sitio y con el
    # mismo formato que las nuestras.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers = []
        logger.propagate = True


setup_logging()
