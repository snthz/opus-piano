import io

import pytest
from PIL import Image

from app import config
from app.errors import ImageTooSmall, UnsupportedType
from app.preprocess import deskew_file, normalize, sniff


def png(width: int, height: int) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, format="PNG")
    return buffer.getvalue()


def jpeg(width: int, height: int) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, format="JPEG")
    return buffer.getvalue()


def test_sniff_reconoce_los_tipos_por_sus_bytes():
    assert sniff(png(10, 10)) == "png"
    assert sniff(jpeg(10, 10)) == "jpeg"
    assert sniff(b"%PDF-1.7\n...") == "pdf"


def test_sniff_rechaza_lo_demas_aunque_se_llame_png():
    with pytest.raises(UnsupportedType):
        sniff(b"GIF89a" + b"\x00" * 20)


def test_una_imagen_pequena_se_rechaza(tmp_path):
    with pytest.raises(ImageTooSmall):
        normalize(png(config.MIN_WIDTH - 1, 800), str(tmp_path))


def test_una_imagen_ancha_se_reduce_conservando_la_proporcion(tmp_path):
    result = normalize(png(4000, 3000), str(tmp_path))
    assert result.resized
    assert result.width == config.MAX_WIDTH
    assert result.height == round(3000 * config.MAX_WIDTH / 4000)
    with Image.open(result.path) as image:
        assert image.size == (result.width, result.height)


def test_una_imagen_en_el_limite_no_se_toca(tmp_path):
    result = normalize(png(config.MAX_WIDTH, 900), str(tmp_path))
    assert not result.resized
    assert (result.width, result.height) == (config.MAX_WIDTH, 900)


def test_la_salida_es_png_gris_en_tres_canales(tmp_path):
    # Gris para que la red no vea color, pero en RGB porque oemer trabaja con
    # imágenes de tres canales.
    result = normalize(jpeg(1200, 900), str(tmp_path))
    with Image.open(result.path) as image:
        assert image.format == "PNG"
        assert image.mode == "RGB"
        pixels = list(image.convert("RGB").getdata())[:50]
        assert all(r == g == b for r, g, b in pixels)


def test_de_un_pdf_se_toma_la_primera_pagina(tmp_path):
    fitz = pytest.importorskip("fitz")
    document = fitz.open()
    document.new_page(width=595, height=842)  # A4 en puntos
    document.new_page(width=100, height=100)  # una segunda que debe ignorarse
    data = document.tobytes()

    result = normalize(data, str(tmp_path))
    assert result.source == "pdf"
    # A4 a 200 ppp son ~1654 px de ancho; la segunda página daría ~278.
    assert result.width > 1000


def test_un_pdf_roto_no_pasa_por_imagen(tmp_path):
    from app.errors import BadPdf

    with pytest.raises(BadPdf):
        normalize(b"%PDF-1.7\nesto no es un pdf", str(tmp_path))


def test_una_pagina_recta_no_se_gira(tmp_path):
    # Girar cuesta nitidez: si no hace falta, no se toca.
    path = str(tmp_path / "recta.png")
    staves(0).save(path)
    assert deskew_file(path) == 0.0


def test_una_pagina_torcida_se_endereza(tmp_path):
    path = str(tmp_path / "torcida.png")
    staves(3).save(path)
    # Se mide la inclinación de las líneas y se corrige; luego ya no queda nada.
    assert deskew_file(path) == pytest.approx(3, abs=0.4)
    assert deskew_file(path) == 0.0


def staves(degrees: float) -> Image.Image:
    """Una página con cinco pentagramas dibujados, girada los grados que se pidan."""
    from PIL import ImageDraw

    image = Image.new("L", (1200, 1600), "white")
    draw = ImageDraw.Draw(image)
    for system in range(5):
        top = 150 + system * 280
        for line in range(5):
            y = top + line * 14
            draw.line((100, y, 1100, y), fill=0, width=2)
    return image.rotate(-degrees, resample=Image.BICUBIC, expand=True, fillcolor=255)
