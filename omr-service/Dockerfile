# Servicio OMR de Opus Piano: oemer (ONNX, solo CPU) detrás de FastAPI.
# Dos etapas para que en la imagen final no queden ni pip ni las ruedas
# descargadas: solo el entorno virtual con lo instalado y los modelos.

FROM python:3.11-slim-bookworm AS build

ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /srv

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./
RUN pip install -r requirements.txt \
 && pip install --no-deps oemer==0.1.8

# Los 110 MB de modelos entran en la imagen. Bajarlos en el arranque en frío
# sería lo que más tardaría de toda la primera petición.
COPY scripts/fetch_models.py ./scripts/
RUN python scripts/fetch_models.py


FROM python:3.11-slim-bookworm AS runtime

# libgomp1: OpenMP, que usan onnxruntime, scipy y scikit-learn.
# libglib2.0-0: la pide opencv aunque sea la variante headless.
# La base se fija a bookworm: en trixie ese paquete pasó a llamarse
# libglib2.0-0t64 y la construcción se caería sin avisar de por qué.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 omr

COPY --from=build /opt/venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    # matplotlib sin pantalla y con su caché en un sitio donde el usuario sin
    # privilegios puede escribir.
    MPLBACKEND=Agg \
    MPLCONFIGDIR=/tmp/matplotlib

WORKDIR /srv
COPY --chown=omr:omr app ./app

USER omr
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/health').read()" || exit 1

# Un solo worker: la concurrencia la reparte Cloud Run levantando instancias,
# que es lo único que sirve cuando cada petición ocupa la CPU entera.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
