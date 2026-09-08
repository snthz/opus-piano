"""
oemer dentro de un proceso propio: `python -m app.omr_worker <imagen> <salida>`.

Va aparte del servidor por tres motivos. Cargar los cuatro modelos deja cientos
de megas de arrays vivos que la biblioteca no libera del todo entre páginas;
oemer guarda su estado en variables globales (`oemer.layers`), así que dos
páginas a la vez en el mismo proceso se pisarían; y un proceso hijo se puede
matar de verdad cuando se agota el tiempo, cosa que con un hilo no se puede.

Códigos de salida: 0 bien, 3 la imagen no tiene una partitura legible,
1 cualquier otro fallo.
"""

import os
import sys
import traceback
from types import SimpleNamespace

from . import config
from .preprocess import deskew_file

EXIT_UNREADABLE = 3


def _limit_onnx_threads(threads: int) -> None:
    """
    Ata la inferencia a `threads` hilos (0 = como venga).

    onnxruntime no hace caso de OMP_NUM_THREADS: dimensiona su propio grupo de
    hilos con los núcleos que ve, y dentro de un contenedor los que ve son los
    de la máquina anfitriona, no los que le han dado. En Cloud Run eso son doce
    hilos peleándose por cuatro vCPU. Como oemer crea las sesiones por su
    cuenta, la única forma de decírselo es envolver el constructor.
    """
    if threads <= 0:
        return
    import onnxruntime as rt

    original = rt.InferenceSession

    class Limited(original):  # type: ignore[misc, valid-type]
        def __init__(self, *args, **kwargs):
            if len(args) < 2 and kwargs.get("sess_options") is None:
                options = rt.SessionOptions()
                options.intra_op_num_threads = threads
                options.inter_op_num_threads = 1
                kwargs["sess_options"] = options
            super().__init__(*args, **kwargs)

    rt.InferenceSession = Limited


def _set_step_size(ete, step: int) -> None:
    """
    Cambia el salto con el que la red recorre la página.

    oemer la parte en recuadros de 256 px y avanza de 128 en 128, así que cada
    píxel pasa por la red cuatro veces y se promedia. El salto no es un
    parámetro suyo —lo lleva por defecto la función que llama—, de modo que la
    única forma de tocarlo sin editar la biblioteca es envolverla.
    """
    if step == 128:
        return
    original = ete.inference

    def with_step(model_path, img_path, *args, **kwargs):
        kwargs.setdefault("step_size", step)
        return original(model_path, img_path, *args, **kwargs)

    ete.inference = with_step


def _set_target_pixels(pixels: int) -> None:
    """
    Cambia el tamaño al que oemer trabaja la página.

    Antes de segmentar, oemer lleva cualquier imagen a unos 3,67 millones de
    píxeles —ni el tamaño que le mandes ni el recorte previo cambian eso—, y de
    ahí sale casi todo el tiempo de inferencia.
    """
    if pixels <= 0:
        return
    from PIL import Image

    from oemer import inference

    def resize(image: Image.Image) -> Image.Image:
        ratio = (pixels / (image.width * image.height)) ** 0.5
        return image.resize((round(image.width * ratio), round(image.height * ratio)))

    inference.resize_image = resize


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: python -m app.omr_worker <image> <output.musicxml>", file=sys.stderr)
        return 1
    image_path, output_path = sys.argv[1], sys.argv[2]

    # Importar oemer arrastra onnxruntime y matplotlib: se hace aquí dentro para
    # que el error de importación, si lo hay, salga por el mismo camino.
    _limit_onnx_threads(config.THREADS)
    from oemer import ete
    from oemer.exceptions import StafflineException

    _set_step_size(ete, config.STEP_SIZE)
    _set_target_pixels(config.TARGET_PIXELS)

    # Enderezar la página antes de leerla. Aquí y no en el servidor: OpenCV se
    # queda cargado en el proceso que lo importa, y este se muere con la página.
    if not config.DEWARP:
        rotated = deskew_file(image_path)
        if rotated:
            print(f"page rotated {rotated} degrees", file=sys.stderr)

    ete.clear_data()
    args = SimpleNamespace(
        img_path=image_path,
        output_path=output_path,
        use_tf=False,
        # Sin caché: el .pkl de predicciones pesa más que la imagen y el
        # directorio temporal se borra al terminar la petición.
        save_cache=False,
        without_deskew=not config.DEWARP,
    )

    try:
        ete.extract(args)
    except StafflineException:
        # No ha encontrado pentagramas: la foto está torcida, borrosa o no es
        # una partitura. Es el fallo más común y merece su propio mensaje.
        print("staffline extraction failed", file=sys.stderr)
        return EXIT_UNREADABLE
    except Exception:  # noqa: BLE001 — el servidor lo registra y lo traduce
        # La traza entera al registro: oemer se rompe por dentro con cierta
        # facilidad (un pentagrama que no cierra, un símbolo raro) y sin ella no
        # hay forma de saber en qué etapa fue. No sale nunca hacia el usuario.
        traceback.print_exc()
        return 1

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        print("oemer produced no MusicXML", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
