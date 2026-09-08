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
