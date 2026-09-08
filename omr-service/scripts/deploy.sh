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

# Los valores salen de medir una página A4 de piano (ver README): ~20 minutos de
# CPU y un pico de ~4,5 GB de memoria.
# --cpu 4: reparte esos 20 minutos de CPU en unos 5 de reloj. Con 1 vCPU serían
#   veinte, más que el máximo de espera razonable de nadie.
# --memory 6Gi: margen sobre el pico medido; si se queda corto, la instancia
#   muere entera y la petición se cae sin explicación.
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
  --cpu 4 \
  --memory 6Gi \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 900 \
  --allow-unauthenticated \
  --set-env-vars "OMR_TOKEN=${OMR_TOKEN},OMR_THREADS=4,OMR_TIMEOUT=600"

URL=$(gcloud run services describe "${SERVICE}" --project "${PROJECT}" --region "${REGION}" --format='value(status.url)')
echo
echo "Listo: ${URL}"
echo "Comprueba:  curl ${URL}/healthz"
echo "En el .env de Opus Piano:  OMR_URL=${URL}  y  OMR_TOKEN=<el mismo>"
echo
echo "Si aún no lo has hecho, pon una alerta de presupuesto de 1 USD:"
echo "  https://console.cloud.google.com/billing/budgets?project=${PROJECT}"
