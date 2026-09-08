#!/usr/bin/env bash
# Levanta el servicio en local sin Docker. La primera vez crea el entorno,
# instala las dependencias y descarga los modelos (110 MB).
#
#   scripts/local_run.sh              # http://localhost:8000
#   PORT=9000 scripts/local_run.sh
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${PORT:-8000}"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  ./.venv/bin/pip install --upgrade pip
fi

./.venv/bin/pip install -q -r requirements-dev.txt
# --no-deps: oemer pide onnxruntime-gpu y con el de CPU le vale (ver requirements.txt).
./.venv/bin/pip install -q --no-deps oemer==0.1.8
./.venv/bin/python scripts/fetch_models.py

echo "OMR en http://localhost:${PORT} (Ctrl-C para parar)"
exec ./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --workers 1
