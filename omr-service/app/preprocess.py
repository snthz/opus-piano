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


#: Aire que se deja alrededor del contenido al recortar, como fracción del lado
#: mayor. Las cabezas de nota pegadas al borde necesitan sitio, y oemer busca
#: los pentagramas con algo de contexto blanco alrededor.
_CROP_MARGIN = 0.02

#: Por debajo de este ahorro de área no se recorta: volver a escribir el PNG
#: cuesta más de lo que vale, y un recorte de nada no cambia la resolución.
_MIN_CROP_SAVING = 0.03


def crop_margins_file(path: str) -> float:
    """
    Recorta los márgenes blancos de la página guardada en `path` y devuelve la
    fracción del área que quitó (0 si no tocó nada).

    No ahorra tiempo: oemer siempre reescala la página a los mismos píxeles
    (`OMR_TARGET_PIXELS`), pase lo que se le pase. Lo que cambia es a qué se
    dedican esos píxeles: en una hoja A4 típica un cuarto de la página es
    margen, y recortarlo le da a la música esa resolución de más.
    """
    with Image.open(path) as image:
        image.load()
        box = content_box(image)
        if box is None:
            return 0.0
        left, top, right, bottom = box
        saving = 1 - ((right - left) * (bottom - top)) / (image.width * image.height)
        if saving < _MIN_CROP_SAVING:
            return 0.0
        image.crop(box).save(path, format="PNG")
    return round(saving, 3)


def content_box(image: Image.Image) -> tuple[int, int, int, int] | None:
    """
    Caja (izquierda, arriba, derecha, abajo) que encierra lo impreso, con su
    margen de aire. `None` si la página está en blanco.

    Se mide sobre una copia pequeña: para saber dónde empieza la tinta no hace
    falta la página entera, y así no cuesta nada. Una fila o columna cuenta
    como contenido cuando tiene varios píxeles oscuros, no uno: un punto de
    polvo del escáner no es música.
    """
    import numpy as np

    scale = min(1.0, 600 / image.width)
    small = image.convert("L")
    if scale < 1.0:
        small = small.resize((round(image.width * scale), round(image.height * scale)), Image.BILINEAR)
    dark = np.array(small) < 128

    rows = np.flatnonzero(dark.sum(axis=1) >= 3)
    cols = np.flatnonzero(dark.sum(axis=0) >= 3)
    if len(rows) == 0 or len(cols) == 0:
        return None

    margin = _CROP_MARGIN * max(image.width, image.height)
    left = max(0, int(cols[0] / scale - margin))
    top = max(0, int(rows[0] / scale - margin))
    right = min(image.width, int((cols[-1] + 1) / scale + margin))
    bottom = min(image.height, int((rows[-1] + 1) / scale + margin))
    return left, top, right, bottom


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
