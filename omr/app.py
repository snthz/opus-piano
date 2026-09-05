"""
Servicio de transcripción óptica de partituras (OMR) para Opus Piano.

Recibe un PDF, convierte cada página a imagen con pdftoppm, pasa cada imagen por
oemer (https://github.com/BreezeWhite/oemer) y une los MusicXML de las páginas
en un solo documento. oemer tarda varios minutos por página en CPU, así que el
trabajo es asíncrono: POST /jobs devuelve un id y GET /jobs/{id} su estado.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile

MAX_PAGES = int(os.environ.get("OMR_MAX_PAGES", "10"))
MAX_BYTES = int(os.environ.get("OMR_MAX_BYTES", str(25 * 1024 * 1024)))
DPI = int(os.environ.get("OMR_DPI", "200"))
JOB_TTL = 60 * 60  # segundos que se conserva un trabajo terminado

app = FastAPI(title="Opus Piano OMR")


@dataclass
class Job:
    id: str
    pdf: Path
    workdir: Path
    status: str = "queued"  # queued | running | done | error
    message: str = "En cola"
    page: int = 0
    pages: int = 0
    xml: str | None = None
    error: str | None = None
    finished_at: float | None = None
    lock: threading.Lock = field(default_factory=threading.Lock)

    def public(self, with_xml: bool) -> dict:
        d = {"id": self.id, "status": self.status, "message": self.message, "page": self.page, "pages": self.pages}
        if self.error:
            d["error"] = self.error
        if with_xml and self.xml is not None:
            d["xml"] = self.xml
        return d


jobs: dict[str, Job] = {}
jobs_lock = threading.Lock()
# oemer consume toda la CPU: un trabajo cada vez.
run_lock = threading.Lock()


def pdf_to_images(pdf: Path, out: Path) -> list[Path]:
    subprocess.run(
        ["pdftoppm", "-r", str(DPI), "-png", "-l", str(MAX_PAGES), str(pdf), str(out / "page")],
        check=True,
        capture_output=True,
        timeout=300,
    )
    return sorted(out.glob("page-*.png"))


def run_oemer(image: Path, out: Path) -> Path:
    """Ejecuta oemer sobre una imagen; si falla, reintenta sin enderezado (issue #9 de oemer)."""
    for extra in ([], ["--without-deskew"]):
        proc = subprocess.run(
            ["oemer", str(image), "-o", str(out), *extra],
            capture_output=True,
            text=True,
            timeout=60 * 30,
        )
        produced = list(out.glob(f"{image.stem}*.musicxml")) + list(out.glob(f"{image.stem}*.xml"))
        if proc.returncode == 0 and produced:
            return produced[0]
        last = proc.stderr.strip().splitlines()[-1] if proc.stderr.strip() else f"código {proc.returncode}"
    raise RuntimeError(f"oemer no pudo leer la página ({last})")


def merge_musicxml(files: list[Path]) -> str:
    """Los compases de cada página se añaden a la primera parte del primer documento."""
    first = ET.parse(files[0])
    root = first.getroot()
    part = root.find("part")
    if part is None:
        raise RuntimeError("oemer no devolvió ninguna parte")
    count = len(part.findall("measure"))
    for f in files[1:]:
        other = ET.parse(f).getroot().find("part")
        if other is None:
            continue
        for m in other.findall("measure"):
            count += 1
            m.set("number", str(count))
            part.append(m)
    # Título por defecto para que la app tenga algo que mostrar.
    if root.find("work") is None and root.find("movement-title") is None:
        title = ET.Element("movement-title")
        title.text = "Transcripción"
        root.insert(0, title)
    return ET.tostring(root, encoding="unicode")


def process(job: Job) -> None:
    with run_lock:
        try:
            job.status = "running"
            job.message = "Convirtiendo el PDF en imágenes…"
            images = pdf_to_images(job.pdf, job.workdir)
            if not images:
                raise RuntimeError("El PDF no tiene páginas legibles")
            job.pages = len(images)
            results: list[Path] = []
            for i, img in enumerate(images, 1):
                job.page = i
                job.message = f"Transcribiendo la página {i} de {job.pages}… (varios minutos por página)"
                out = job.workdir / f"out-{i}"
                out.mkdir(exist_ok=True)
                results.append(run_oemer(img, out))
            job.message = "Uniendo las páginas…"
            job.xml = merge_musicxml(results)
            job.status = "done"
            job.message = "Listo"
        except subprocess.TimeoutExpired:
            job.status, job.error = "error", "La transcripción tardó demasiado y se canceló."
        except Exception as e:  # noqa: BLE001 — se informa al cliente, no se oculta
            job.status, job.error = "error", str(e)[:500]
        finally:
            job.finished_at = time.time()
            shutil.rmtree(job.workdir, ignore_errors=True)


def cleanup() -> None:
    now = time.time()
    with jobs_lock:
        for jid, j in list(jobs.items()):
            if j.finished_at and now - j.finished_at > JOB_TTL:
                del jobs[jid]


@app.get("/health")
def health() -> dict:
    return {"ok": True, "oemer": shutil.which("oemer") is not None, "pdftoppm": shutil.which("pdftoppm") is not None}


@app.post("/jobs", status_code=201)
async def create_job(file: UploadFile) -> dict:
    cleanup()
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "El PDF supera el tamaño máximo")
    if not data.startswith(b"%PDF"):
        raise HTTPException(400, "El archivo no es un PDF")
    workdir = Path(tempfile.mkdtemp(prefix="omr-"))
    pdf = workdir / "in.pdf"
    pdf.write_bytes(data)
    job = Job(id=str(uuid.uuid4()), pdf=pdf, workdir=workdir)
    with jobs_lock:
        jobs[job.id] = job
    threading.Thread(target=process, args=(job,), daemon=True).start()
    return job.public(with_xml=False)


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Trabajo no encontrado")
    return job.public(with_xml=True)
