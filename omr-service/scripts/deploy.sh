#!/usr/bin/env bash
# Despliegue en Cloud Run desde el código fuente (Cloud Build construye la imagen).
#
#   OMR_TOKEN=$(openssl rand -hex 24) scripts/deploy.sh
#
# El token se guarda como variable del servicio y hay que ponerlo también en el
# .env de la aplicación (OMR_TOKEN), que es quien llama. Sin token el servicio
# queda abierto a cualquiera que dé con la URL.
set -euo pipefail

cd "$(dirname "$0")/.."

SERVICE="${SERVICE:-opus-omr}"
REGION="${REGION:-us-central1}"
PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"

if [ -z "${PROJECT}" ]; then
  echo "No hay proyecto: gcloud config set project <id>" >&2
  exit 1
fi
if [ -z "${OMR_TOKEN:-}" ]; then
  echo "Falta OMR_TOKEN. Genera uno: OMR_TOKEN=\$(openssl rand -hex 24) $0" >&2
  exit 1
fi

# Los valores salen de medir una página A4 de piano en este mismo servicio (ver
# README): 7 minutos de reloj, 1,5 vCPU de media y un pico de 2,9 GB.
# --cpu 8: lo que queda es casi todo inferencia y sí se reparte, así que doblar
#   la CPU baja el tiempo casi a la mitad por un gasto parecido (se pagan
#   vCPU-segundos, y son los mismos en la mitad de tiempo).
# --memory 8Gi: el pico ronda los 6 GB, y sube con los hilos de inferencia
#   porque onnxruntime reserva memoria por hilo. Ojo con la métrica de memoria
#   de Cloud Run para ajustarla: es la media de cada minuto, no el pico, y con
#   ella parecía que sobraba sitio en 4 GiB —marcaba 2,9 GB— hasta que una
#   página tumbó la instancia. Cuando se queda corta, el contenedor muere
#   entero y la página se cae a mitad, sin error que explique nada.
# --concurrency 1: oemer ocupa la CPU entera, dos páginas a la vez en la misma
#   instancia tardan más que dos seguidas.
# --min-instances 0: en reposo no se paga nada; a cambio, el primer uso del día
#   arranca en frío (la imagen lleva los modelos dentro para que sea corto).
# --max-instances 3: techo contra un pico raro que se coma el free tier.
# --timeout 900: por encima del corte interno de oemer (OMR_TIMEOUT, 600 s).
gcloud run deploy "${SERVICE}" \
  --project "${PROJECT}" \
  --source . \
  --region "${REGION}" \
  --cpu 8 \
  --memory 8Gi \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 900 \
  --allow-unauthenticated \
  --set-env-vars "OMR_TOKEN=${OMR_TOKEN},OMR_THREADS=8,OMR_TIMEOUT=600"

URL=$(gcloud run services describe "${SERVICE}" --project "${PROJECT}" --region "${REGION}" --format='value(status.url)')
echo
echo "Listo: ${URL}"
echo "Comprueba:  curl ${URL}/health"
echo "En el .env de Opus Piano:  OMR_URL=${URL}  y  OMR_TOKEN=<el mismo>"
echo
echo "Si aún no lo has hecho, pon una alerta de presupuesto de 1 USD:"
echo "  https://console.cloud.google.com/billing/budgets?project=${PROJECT}"
