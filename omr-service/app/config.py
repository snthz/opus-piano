"""
Configuración por variables de entorno. Sin dependencias: son cuatro valores y
el contenedor los fija de una vez al arrancar.
"""

import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, "") or default)
    except ValueError:
        return default


def _bool(name: str, default: bool) -> bool:
    value = os.environ.get(name, "").strip().lower()
    return default if not value else value not in ("0", "false", "no")


#: Puerto de escucha. Cloud Run lo inyecta.
PORT = _int("PORT", 8080)

#: Si está definido, cada petición debe traer «Authorization: Bearer <token>».
#: El servicio se despliega público (sin IAM), así que este es el único cerrojo.
TOKEN = os.environ.get("OMR_TOKEN", "").strip()

#: Tamaño máximo del archivo subido.
MAX_UPLOAD_BYTES = _int("OMR_MAX_UPLOAD_MB", 10) * 1024 * 1024

#: Ancho al que se reduce la imagen antes de oemer. Es lo que más manda en la
#: memoria que gasta la inferencia: el doble de ancho es cuatro veces de píxeles.
MAX_WIDTH = _int("OMR_MAX_WIDTH", 2000)

#: Por debajo de este ancho no hay detalle suficiente y oemer devuelve ruido.
MIN_WIDTH = _int("OMR_MIN_WIDTH", 600)

#: Corte duro de oemer. Una página A4 tarda unos cinco minutos con cuatro vCPU;
#: pasado el doble, algo ha ido mal y la petición ya no le sirve a nadie.
TIMEOUT_SECONDS = _int("OMR_TIMEOUT", 600)

#: Resolución a la que se rasteriza un PDF (solo su primera página).
PDF_DPI = _int("OMR_PDF_DPI", 200)

#: Hilos de la inferencia. 0 deja que onnxruntime decida (lo normal en local);
#: en Cloud Run se pone el número de vCPU del servicio, porque dentro de un
#: contenedor onnxruntime cuenta los núcleos del anfitrión y se pasa.
THREADS = _int("OMR_THREADS", 0)


#: Enderezado profundo de oemer, el que corrige una página *curvada* (la foto
#: de un libro grueso). Remuestrea ocho imágenes del tamaño de la página, de un
#: solo hilo, y es lo que más tarda de todo el reconocimiento: minutos. Apagado
#: por defecto, porque la inclinación —que es el problema real del 99 % de los
#: escaneos— ya la corrige `preprocess` girando la página una sola vez.
#: Cada petición puede pedirlo con el campo «dewarp».
DEWARP = _bool("OMR_DEWARP", False)

#: Salto entre los recuadros con los que la red recorre la página (256 px en el
#: primer modelo, 288 en el segundo). oemer trae 128: cada píxel pasa cuatro
#: veces por la red y se promedia. Con 224 el trabajo baja a un tercio y en la
#: página de prueba salen las mismas notas; se queda ahí y no en 256 (que iría
#: algo más rápido) porque con 32 px de solape en los dos modelos ninguna
#: cabeza de nota puede caer partida entre dos recuadros, y una nota perdida
#: no se nota hasta que suena.
STEP_SIZE = _int("OMR_STEP_SIZE", 224)


#: Recortar los márgenes blancos antes de reconocer. Como oemer trabaja a un
#: número fijo de píxeles, quitar el margen le da esa resolución a la música.
#: Apagado por defecto: en la página de prueba (con un 4 % de margen) el
#: recorte hizo que los tres sostenidos de un compás salieran como becuadros;
#: los clasificadores de oemer esperan los símbolos al tamaño de una página
#: entera y no perdonan el cambio de escala. Queda como opción para probar con
#: páginas de márgenes anchos, que es donde podría compensar.
CROP_MARGINS = _bool("OMR_CROP_MARGINS", False)

#: Píxeles a los que oemer reduce (o amplía) la página antes de pasarla por la
#: red. Su valor de fábrica son 3,67 millones —pase lo que se le pase— y el
#: tiempo de inferencia va con ellos. A 2,4 la página de prueba sale con los
#: mismos compases y las mismas alturas en un 60 % del tiempo; bajar mucho más
#: empezaría a comerse los símbolos pequeños (alteraciones, silencios).
#: 0 deja el suyo.
TARGET_PIXELS = _int("OMR_TARGET_PIXELS", 2_400_000)
