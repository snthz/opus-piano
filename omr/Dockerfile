# Servicio de transcripción óptica (oemer) para Opus Piano.
FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

# pdftoppm (poppler) convierte el PDF en imágenes; libgl/glib los pide OpenCV.
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils libgl1 libglib2.0-0 curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# oemer sin dependencias (evita onnxruntime-gpu) y el resto explícito.
RUN pip install --no-deps oemer==0.1.8 \
 && grep -v '^oemer' requirements.txt > /tmp/req.txt \
 && pip install -r /tmp/req.txt

# Modelos: se descargan en la imagen para no depender de GitHub al arrancar.
RUN OEMER_DIR="$(python -c 'import oemer, os; print(os.path.dirname(oemer.__file__))')" \
 && mkdir -p "$OEMER_DIR/checkpoints/unet_big" "$OEMER_DIR/checkpoints/seg_net" \
 && curl -fsSL -o "$OEMER_DIR/checkpoints/unet_big/model.onnx" https://github.com/BreezeWhite/oemer/releases/download/checkpoints/1st_model.onnx \
 && curl -fsSL -o "$OEMER_DIR/checkpoints/seg_net/model.onnx"  https://github.com/BreezeWhite/oemer/releases/download/checkpoints/2nd_model.onnx

COPY app.py run_oemer.py .

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD curl -fs http://localhost:8000/health || exit 1
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
