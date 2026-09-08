#!/usr/bin/env python3
"""
Descarga los modelos de oemer dentro del paquete instalado.

oemer los baja solo la primera vez que se le pide una partitura. En un servicio
que escala a cero eso significaría que la primera petición de cada arranque en
frío se pasa un minuto descargando 110 MB, así que se hacen aquí: en la
construcción de la imagen, y de paso se comprueba que son los que esperamos.

Solo los dos .onnx. Los .h5 que oemer descargaría también son los pesos para
TensorFlow, que este servicio no usa.
"""

import hashlib
import os
import sys
import urllib.request

BASE = "https://github.com/BreezeWhite/oemer/releases/download/checkpoints"

# destino dentro de oemer/checkpoints -> (archivo en la release, sha256)
MODELS = {
    "unet_big/model.onnx": ("1st_model.onnx", "37512e858731096439746f60b377c049f07055b4a23ec6eb9a178ce92cfba174"),
    "seg_net/model.onnx": ("2nd_model.onnx", "ed2e1a86ea75712ee6cdc740e96f7a36753543cf9bb980227c071c9256d9d82e"),
}


def digest(path: str) -> str:
    sha = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            sha.update(chunk)
    return sha.hexdigest()


def main() -> int:
    import oemer

    root = os.path.join(os.path.dirname(oemer.__file__), "checkpoints")
    for target, (name, expected) in MODELS.items():
        path = os.path.join(root, target)
        if os.path.exists(path) and digest(path) == expected:
            print(f"{target}: ya está")
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        print(f"{target}: descargando {name}…")
        urllib.request.urlretrieve(f"{BASE}/{name}", path)
        got = digest(path)
        if got != expected:
            os.remove(path)
            print(f"{target}: sha256 {got}, se esperaba {expected}", file=sys.stderr)
            return 1
        print(f"{target}: {os.path.getsize(path) // (1024 * 1024)} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
