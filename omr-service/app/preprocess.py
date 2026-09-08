"""
Normalización de lo que llega antes de dárselo a oemer: una sola página, en
escala de grises y con un ancho acotado.

El recorte de ancho no es cosmético: la red segmenta la página entera de una
vez, así que la memoria y el tiempo van con el número de píxeles. Una foto de
móvil de 4000 px de ancho cuadruplica el trabajo frente a los 2000 px con los
que oemer ya distingue las líneas del pentagrama.
"""

from __future__ import annotations

import io
import os
from dataclasses import dataclass

from PIL import Image

from . import config
from .errors import BadPdf, ImageTooSmall, UnsupportedType

#: Tipo real del archivo por sus primeros bytes; la extensión y el
#: Content-Type los pone quien llama y no valen como comprobación.
_MAGIC = (
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpeg"),
    (b"%PDF-", "pdf"),
)


def sniff(data: bytes) -> str:
    for magic, kind in _MAGIC:
        if data.startswith(magic):
            return kind
    raise UnsupportedType("Only PNG, JPEG or PDF are accepted")


@dataclass
class Normalized:
    path: str
    width: int
    height: int
    #: "png", "jpeg" o "pdf": de dónde salió la imagen
    source: str
    #: Se redujo el ancho para llegar a MAX_WIDTH
    resized: bool


def _first_pdf_page(data: bytes) -> Image.Image:
    import fitz  # PyMuPDF; se importa aquí para no cargarlo si nunca llega un PDF

    try:
        with fitz.open(stream=data, filetype="pdf") as doc:
            if doc.page_count < 1:
                raise BadPdf("The PDF has no pages")
            pix = doc.load_page(0).get_pixmap(dpi=config.PDF_DPI)
            return Image.open(io.BytesIO(pix.tobytes("png")))
    except BadPdf:
        raise
    except Exception as exc:  # PDF cifrado, roto o que no es tal
        raise BadPdf("The PDF could not be read") from exc


def normalize(data: bytes, workdir: str) -> Normalized:
    """Deja en `workdir` un PNG listo para oemer y describe lo que hizo."""
    source = sniff(data)
    if source == "pdf":
        image = _first_pdf_page(data)
    else:
        try:
            image = Image.open(io.BytesIO(data))
            image.load()
        except Exception as exc:
            raise UnsupportedType("The image could not be read") from exc

    width, height = image.size
    if width < config.MIN_WIDTH:
        raise ImageTooSmall(f"The image is {width}px wide; at least {config.MIN_WIDTH}px are needed")

    # Con transparencia, el fondo se pone blanco: al pasar a gris sin más, lo
    # transparente sale negro y la página entera queda en negativo.
    if image.mode in ("RGBA", "LA", "PA") or "transparency" in image.info:
        flat = Image.new("RGBA", image.size, (255, 255, 255, 255))
        flat.alpha_composite(image.convert("RGBA"))
        image = flat

    # Gris para quitarle a la red el color, que en una partitura no aporta nada,
    # y de vuelta a tres canales porque oemer trabaja con imágenes RGB.
    image = image.convert("L")

    resized = width > config.MAX_WIDTH
    if resized:
        height = max(1, round(height * config.MAX_WIDTH / width))
        width = config.MAX_WIDTH
        image = image.resize((width, height), Image.LANCZOS)

    path = os.path.join(workdir, "page.png")
    image.convert("RGB").save(path, format="PNG", optimize=False)
    return Normalized(path=path, width=width, height=height, source=source, resized=resized)
