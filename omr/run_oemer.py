"""
Lanza oemer con un tamaño de lote pequeño.

El comando `oemer` hace la inferencia en lotes de 16 ventanas de 256×256 y con
eso una página normal supera los 7 GB de RAM (medido). El tamaño de lote no se
puede cambiar desde la línea de órdenes, así que se llama a la misma función
`extract` sustituyendo `inference` por una versión con `batch_size` reducido.

Uso: python run_oemer.py <imagen> <carpeta_salida> [--without-deskew]
Imprime la ruta del MusicXML generado.
"""

import functools
import os
import sys
from argparse import Namespace

import oemer.ete as ete
from oemer.inference import inference

BATCH = int(os.environ.get("OMR_BATCH", "4"))


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit("uso: run_oemer.py <imagen> <carpeta_salida> [--without-deskew]")
    img, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    # ete.py importó `inference` por nombre: hay que sustituirlo en su espacio de nombres.
    ete.inference = functools.partial(inference, batch_size=BATCH)
    args = Namespace(
        img_path=img,
        output_path=out,
        use_tf=False,
        save_cache=False,
        without_deskew="--without-deskew" in sys.argv[3:],
    )
    ete.clear_data()
    print(ete.extract(args))


if __name__ == "__main__":
    main()
