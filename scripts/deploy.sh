#!/usr/bin/env bash
#
# Deploy del Sistema de Ventas de Rifas a Google Cloud Run.
# Lee .env.local para los valores NO secretos. Los secretos
# (TURSO_AUTH_TOKEN, MERCADO_PAGO_ACCESS_TOKEN, MERCADO_PAGO_CLIENT_SECRET,
# MERCADO_PAGO_WEBHOOK_SECRET, CRON_SECRET) viven en Secret Manager.
#
# Uso: ./scripts/deploy.sh
#
# Prerequisitos one-time (ver docs/superpowers/specs/2026-05-02-migracion-cloud-run-design.md):
#   - APIs habilitadas en el proyecto: run, cloudbuild, artifactregistry, secretmanager
#   - 5 secrets creados con nombres exactos: turso-auth-token, mp-access-token,
#     mp-client-secret, mp-webhook-secret, cron-secret
#   - Service account de Cloud Run (PROJECT_NUMBER-compute@developer.gserviceaccount.com)
#     con role roles/secretmanager.secretAccessor sobre los 5 secrets
#   - Repositorio Artifact Registry "app" en us-east1
#
set -euo pipefail

# Anclar al directorio raíz del repo independientemente de desde dónde se invoque
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env.local ]; then
  echo "ERROR: .env.local no existe en $(pwd). Sin él no se pueden setear las env vars no-secretas."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.local
set +a

PROJECT="sistema-ventas-rifas-prod"
SERVICE="sistema-ventas-rifas"
REGION="us-east1"

# Validar que las 4 vars no-secretas existen
for var in TURSO_DATABASE_URL MERCADO_PAGO_PUBLIC_KEY MERCADO_PAGO_CLIENT_ID NEXT_PUBLIC_BASE_URL; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: variable $var vacía o ausente en .env.local"
    exit 1
  fi
done

# Pre-flight checks de gcloud
command -v gcloud >/dev/null || { echo "ERROR: gcloud CLI no instalado. Instalalo: https://cloud.google.com/sdk/docs/install"; exit 1; }
gcloud auth print-access-token >/dev/null 2>&1 || { echo "ERROR: gcloud no autenticado. Corré: gcloud auth login"; exit 1; }

echo "🚀 Deploying $SERVICE a $PROJECT en $REGION..."

gcloud run deploy "$SERVICE" \
  --source=. \
  --region="$REGION" \
  --project="$PROJECT" \
  --allow-unauthenticated \
  --min-instances=0 --max-instances=10 \
  --memory=512Mi --cpu=1 --timeout=60s \
  --port=8080 \
  --set-env-vars="TURSO_DATABASE_URL=${TURSO_DATABASE_URL},MERCADO_PAGO_PUBLIC_KEY=${MERCADO_PAGO_PUBLIC_KEY},MERCADO_PAGO_CLIENT_ID=${MERCADO_PAGO_CLIENT_ID},NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}" \
  --set-secrets="TURSO_AUTH_TOKEN=turso-auth-token:latest,MERCADO_PAGO_ACCESS_TOKEN=mp-access-token:latest,MERCADO_PAGO_CLIENT_SECRET=mp-client-secret:latest,MERCADO_PAGO_WEBHOOK_SECRET=mp-webhook-secret:latest,CRON_SECRET=cron-secret:latest"

echo ""
echo "✅ Deploy listo. URL pública:"
gcloud run services describe "$SERVICE" \
  --region="$REGION" --project="$PROJECT" \
  --format='value(status.url)'
