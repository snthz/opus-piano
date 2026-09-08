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


#: Por debajo de esta inclinación no se toca la imagen: girar tiene su propio
#: coste en nitidez y una décima de grado no la endereza, la emborrona.
_MIN_SKEW_DEGREES = 0.2

#: Y por encima de esto no es una partitura inclinada, es otra cosa (una foto
#: de lado, una página en vertical); girarla sería empeorarla.
_MAX_SKEW_DEGREES = 12.0


def deskew_file(path: str) -> float:
    """
    Endereza la página guardada en `path` y devuelve los grados que la giró.

    Se llama desde el proceso que ejecuta oemer, no desde el servidor: OpenCV
    ocupa un par de cientos de megas y el servidor vive entre peticiones,
    mientras que el hijo se muere con cada página y además ya lo tiene cargado.
    """
    with Image.open(path) as image:
        image.load()
        skew = estimate_skew(image)
        if abs(skew) < _MIN_SKEW_DEGREES:
            return 0.0
        image.rotate(skew, resample=Image.BICUBIC, expand=True, fillcolor=255).save(path, format="PNG")
    return round(skew, 2)


def estimate_skew(image: Image.Image) -> float:
    """
    Grados que hay que girar la página para dejar sus pentagramas horizontales.

    Las líneas del pentagrama son lo más largo y lo más recto que hay en una
    partitura, así que se buscan con Hough sobre una copia pequeña y se toma la
    inclinación mediana de las que salen casi horizontales. Sale en menos de un
    segundo, frente a los minutos que tarda el enderezado de oemer, que
    remuestrea la página entera ocho veces.
    """
    import cv2
    import numpy as np

    # Con 1000 px de ancho sobra para medir un ángulo, y es lo que hace que
    # esto no cueste nada.
    scale = min(1.0, 1000 / image.width)
    small = image.convert("L")
    if scale < 1.0:
        small = small.resize((round(image.width * scale), round(image.height * scale)), Image.BILINEAR)
    array = np.array(small)

    # Lo oscuro sobre lo claro: las líneas, las notas y el texto.
    mask = cv2.adaptiveThreshold(array, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 25, 10)
    # Un pentagrama mide de lado a lado; se buscan segmentos de al menos un
    # cuarto del ancho para no medir el ángulo de una plica o de una letra.
    min_length = max(60, array.shape[1] // 4)
    lines = cv2.HoughLinesP(mask, 1, np.pi / 720, threshold=120, minLineLength=min_length, maxLineGap=8)
    if lines is None:
        return 0.0

    angles = []
    for x1, y1, x2, y2 in lines.reshape(-1, 4):
        if x2 == x1:
            continue
        angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
        if abs(angle) <= _MAX_SKEW_DEGREES:
            angles.append(angle)
    if len(angles) < 4:  # con cuatro segmentos no hay ni un pentagrama entero
        return 0.0
    return float(np.median(angles))


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
