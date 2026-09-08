"""
Llamada a oemer y recogida del MusicXML.
"""

from __future__ import annotations

import logging
import os
import signal
import subprocess
import sys
import time
from dataclasses import dataclass

from . import config
from .errors import EmptyScore, OmrFailed, OmrTimeout
from .omr_worker import EXIT_UNREADABLE

log = logging.getLogger("omr")

#: Cuánto stderr de oemer se guarda para el registro. Escupe una línea por
#: etapa, así que con esto sobra para saber dónde se cayó.
_STDERR_TAIL = 4000


@dataclass
class OmrResult:
    musicxml: str
    seconds: float


def run_omr(image_path: str, workdir: str) -> OmrResult:
    """Reconoce la partitura de `image_path` y devuelve su MusicXML."""
    output_path = os.path.join(workdir, "score.musicxml")
    env = dict(os.environ)
    if config.THREADS > 0:
        # numpy, OpenBLAS y scikit-learn (media hora de trabajo después de la
        # inferencia) cuentan los núcleos del anfitrión, no los del contenedor.
        # A onnxruntime esto no le dice nada: a ese lo ata el propio worker.
        for var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
            env[var] = str(config.THREADS)
    env["MPLBACKEND"] = "Agg"  # matplotlib sin pantalla

    started = time.monotonic()
    process = subprocess.Popen(
        [sys.executable, "-m", "app.omr_worker", image_path, output_path],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        # Grupo propio: al agotarse el tiempo hay que llevarse por delante
        # también a los hijos que oemer haya podido dejar abiertos.
        start_new_session=True,
    )
    try:
        _, stderr = process.communicate(timeout=config.TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        _kill(process)
        process.communicate()
        raise OmrTimeout(f"Recognition took longer than {config.TIMEOUT_SECONDS}s")

    seconds = time.monotonic() - started
    tail = (stderr or b"").decode("utf-8", "replace")[-_STDERR_TAIL:]

    if process.returncode == EXIT_UNREADABLE:
        log.warning("oemer could not read the score", extra={"stderr": tail})
        raise EmptyScore("No staves were found in the image")
    if process.returncode != 0:
        # El detalle se queda en el registro: puede llevar rutas y trazas.
        log.error("oemer failed (exit %s)", process.returncode, extra={"stderr": tail})
        raise OmrFailed("Recognition failed")

    with open(output_path, "r", encoding="utf-8") as handle:
        musicxml = handle.read()
    if "<note" not in musicxml:
        raise EmptyScore("No notes were recognised in the image")
    return OmrResult(musicxml=musicxml, seconds=seconds)


def _kill(process: subprocess.Popen) -> None:
    try:
        os.killpg(os.getpgid(process.pid), signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        process.kill()
