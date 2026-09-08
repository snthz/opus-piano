import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import config, main
from app.errors import EmptyScore, OmrTimeout
from app.omr import OmrResult

MUSICXML = '<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1"><note/></measure></part></score-partwise>'


@pytest.fixture
def client(monkeypatch):
    # oemer no entra en estos tests: tarda un minuto por página y lo que se
    # comprueba aquí es el contrato HTTP, no lo que reconoce.
    monkeypatch.setattr(main, "run_omr", lambda path, workdir, dewarp=None: OmrResult(musicxml=MUSICXML, seconds=1.5))
    return TestClient(main.app)


def page(width: int = 1200, height: int = 1600) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, format="PNG")
    return buffer.getvalue()


def upload(client, data: bytes, name: str = "page.png", **kwargs):
    return client.post("/v1/transcribe", files={"file": (name, data, "image/png")}, **kwargs)


@pytest.mark.parametrize("path", ["/health", "/healthz"])
def test_la_comprobacion_de_vida_responde_sin_tocar_los_modelos(client, path):
    # Dos rutas: en Cloud Run «/healthz» la atrapa el frontend de Google.
    response = client.get(path)
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_sin_token_no_se_llega_ni_a_leer_el_archivo(client, monkeypatch):
    monkeypatch.setattr(config, "TOKEN", "secreto")
    response = client.post("/v1/transcribe")  # sin multipart siquiera
    assert response.status_code == 401


def test_una_pagina_devuelve_su_musicxml(client):
    response = upload(client, page())
    assert response.status_code == 200
    body = response.json()
    assert body["musicxml"] == MUSICXML
    assert body["image"]["width"] == 1200
    assert body["seconds"] == 1.5


def test_un_archivo_demasiado_grande_se_corta(client, monkeypatch):
    monkeypatch.setattr(config, "MAX_UPLOAD_BYTES", 1024)
    response = upload(client, page(2000, 2000))
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "TOO_LARGE"


def test_un_tipo_que_no_es_imagen_se_rechaza(client):
    response = upload(client, b"GIF89a" + b"\x00" * 100, name="page.gif")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "UNSUPPORTED_TYPE"


def test_una_imagen_pequena_se_rechaza_con_su_codigo(client):
    response = upload(client, page(320, 200))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "IMAGE_TOO_SMALL"


def test_sin_pentagramas_el_error_lo_dice(client, monkeypatch):
    def falla(path, workdir, dewarp=None):
        raise EmptyScore("No staves were found in the image")

    monkeypatch.setattr(main, "run_omr", falla)
    response = upload(client, page())
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "EMPTY_SCORE"


def test_el_corte_de_tiempo_sale_como_504(client, monkeypatch):
    def tarda(path, workdir, dewarp=None):
        raise OmrTimeout("Recognition took longer than 300s")

    monkeypatch.setattr(main, "run_omr", tarda)
    response = upload(client, page())
    assert response.status_code == 504
    assert response.json()["error"]["code"] == "OMR_TIMEOUT"


def test_un_fallo_inesperado_no_se_cuenta_por_dentro(client, monkeypatch):
    def revienta(path, workdir, dewarp=None):
        raise RuntimeError("/tmp/omr-abc123/page.png: cannot allocate")

    monkeypatch.setattr(main, "run_omr", revienta)
    # Como el servidor de verdad: el error se convierte en respuesta y además
    # se relanza para que quede en el registro. TestClient, por defecto, lo
    # dejaría salir por aquí en vez de devolver la respuesta.
    response = upload(TestClient(main.app, raise_server_exceptions=False), page())
    assert response.status_code == 500
    assert response.json() == {"error": {"code": "INTERNAL", "message": "Unexpected error"}}


def test_con_token_configurado_hace_falta_traerlo(client, monkeypatch):
    monkeypatch.setattr(config, "TOKEN", "secreto")
    assert upload(client, page()).status_code == 401
    assert upload(client, page(), headers={"Authorization": "Bearer otro"}).status_code == 401
    assert upload(client, page(), headers={"Authorization": "Bearer secreto"}).status_code == 200


def test_solo_una_pagina_a_la_vez_por_instancia(client, monkeypatch):
    # La segunda petición no espera: se le dice que está ocupado y Cloud Run
    # levanta otra instancia para ella.
    monkeypatch.setattr(main._slot, "acquire", lambda blocking=True: False)
    response = upload(client, page())
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "BUSY"


def test_el_enderezado_profundo_se_pide_por_peticion(client, monkeypatch):
    # Por defecto va apagado (cuesta minutos); una página curvada puede pedirlo.
    visto = {}

    def anota(path, workdir, dewarp=None):
        visto["dewarp"] = dewarp
        return OmrResult(musicxml=MUSICXML, seconds=1.0)

    monkeypatch.setattr(main, "run_omr", anota)
    upload(client, page())
    assert visto["dewarp"] is None

    client.post("/v1/transcribe", files={"file": ("page.png", page(), "image/png")}, data={"dewarp": "true"})
    assert visto["dewarp"] is True
