# Migración Vercel → Google Cloud Run — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el deploy productivo del Sistema de Ventas de Rifas desde Vercel (workspace pausado, proyecto eliminado) a Google Cloud Run en `us-east1`, manteniendo 100% Free Tier y respetando la criticidad anti-sobreventa.

**Architecture:** Cloud Run service con min=0 instancias, imagen multi-stage Node 20 alpine vía Dockerfile. Secret Manager para los 4 tokens críticos (Turso + 3 de MercadoPago). URL default de Cloud Run (no custom domain). Deploy manual con `gcloud run deploy --source .` desde un script local. Turso y MercadoPago no se tocan; solo se actualiza la URL del webhook IPN al final.

**Tech Stack:** Next.js 14.2.5 App Router, Node 20 alpine, Drizzle ORM 0.32.2 + Turso, mercadopago SDK 2.0.15, gcloud CLI 559.0.0, Cloud Build, Artifact Registry, Secret Manager.

**Spec asociado:** `docs/superpowers/specs/2026-05-02-migracion-cloud-run-design.md`

---

## File Structure

### Archivos NUEVOS

| Path | Responsabilidad |
|---|---|
| `Dockerfile` | Multi-stage build (deps → builder → runner) Node 20 alpine. Usa `output: 'standalone'` de Next.js. ~30 líneas. |
| `.dockerignore` | Excluye `node_modules`, `.next`, `.git`, `.env*`, docs y artifacts del repo del build context. |
| `scripts/deploy.sh` | Wrapper bash sobre `gcloud run deploy --source .`. Lee `.env.local` para los 4 valores no-secretos. NO contiene credenciales. |

### Archivos MODIFICADOS

| Path | Cambio |
|---|---|
| `next.config.js` | Agregar `output: 'standalone'` al objeto de config. |
| `CLAUDE.md` | Sección "Hosting" + Commands + Critical Rules: reemplazar Vercel con Cloud Run. |
| `MEMORIA.md` | Nueva entrada en "Historial de Sesiones" para esta migración. |
| `ESTADO.md` | Marcar 1.4 cumplida + nueva bitácora. |
| `BUGS.md` | Nuevo BUG-007 (Vercel pause + recovery via Cloud Run). |
| `LEARNINGS.md` | 4 aprendizajes nuevos. |

### Archivos RENOMBRADOS

| Antes | Después | Cambio |
|---|---|---|
| `.claude/commands/deploy-vercel.md` | `.claude/commands/deploy.md` | Reescrito completo para reflejar pipeline Cloud Run. |

### Archivos NO TOCADOS

`app/`, `components/`, `lib/`, `package.json`, `package-lock.json`, `drizzle.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `.eslintrc.json`. Es Next.js estándar y corre igual en cualquier runtime Node.

---

## Task 1: Adaptar Next.js para containerización

**Files:**
- Modify: `next.config.js`
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Modificar `next.config.js` para agregar `output: 'standalone'`**

Reemplazar el contenido de `next.config.js` por:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  },
  images: {
    domains: ['localhost'],
  },
}

module.exports = nextConfig
```

- [ ] **Step 2: Crear `Dockerfile` multi-stage**

Crear archivo `Dockerfile` en la raíz del repo con:

```dockerfile
# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
```

- [ ] **Step 3: Crear `.dockerignore`**

Crear archivo `.dockerignore` en la raíz del repo con:

```
node_modules
.next
.git
.gitignore
.env
.env.*
!.env.example
*.md
old_docs/
docs/
.claude/
.vercel
.DS_Store
*.log
*.csv
test-*.js
run-*.js
simple-*.js
.next.test
```

- [ ] **Step 4: Verificar que `npm run lint` sigue pasando**

Ejecutar:
```bash
npm run lint
```
Resultado esperado: 0 errores. Las 3 warnings preexistentes de `react-hooks/exhaustive-deps` en `RifasApp.tsx` (líneas 629, 665, 683) son aceptables.

- [ ] **Step 5: Verificar que `npm run build` genera el directorio standalone**

Ejecutar:
```bash
rm -rf .next
npm run build
test -f .next/standalone/server.js && echo "OK standalone server.js generado" || echo "FALLO: falta .next/standalone/server.js"
test -d .next/standalone/.next/server && echo "OK standalone .next/server presente" || echo "FALLO: falta .next/server en standalone"
test -d .next/static && echo "OK .next/static presente" || echo "FALLO: falta .next/static"
```
Resultado esperado: 3 líneas con "OK ..."

- [ ] **Step 6: Verificar que el build standalone arranca localmente**

Ejecutar (en otra terminal o como background):
```bash
cd .next/standalone
set -a; source ../../.env.local; set +a
HOSTNAME=0.0.0.0 PORT=3001 node server.js &
SERVER_PID=$!
sleep 5
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/
curl -s http://localhost:3001/api/raffle/config | head -c 200
echo ""
kill $SERVER_PID
cd ../..
```
Resultado esperado:
- `HTTP 200` para la home.
- JSON con `{"id":"...","title":"Rifa Escolar 2025",...}` para `/api/raffle/config`.

> Si el server no arranca o devuelve 500, revisar que `.env.local` tenga `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` válidos. **No avanzar a Task 2** hasta que esto pase.

- [ ] **Step 7: Commit de los cambios de containerización**

```bash
git add next.config.js Dockerfile .dockerignore
git commit -m "feat(deploy): añadir Dockerfile multi-stage + output standalone para Cloud Run

- next.config.js: output: 'standalone' para producir .next/standalone/server.js bundleado
- Dockerfile: multi-stage Node 20 alpine, runner final ~150 MB, usuario no-root
- .dockerignore: excluye node_modules/.next/.git/.env y artefactos del repo del build context

Preparación para migración Vercel → Cloud Run (spec docs/superpowers/specs/2026-05-02-migracion-cloud-run-design.md)"
```

---

## Task 2: Crear script de deploy local

**Files:**
- Create: `scripts/deploy.sh`

- [ ] **Step 1: Crear directorio `scripts/` si no existe**

```bash
mkdir -p scripts
```

- [ ] **Step 2: Crear `scripts/deploy.sh`**

Crear archivo `scripts/deploy.sh` con el contenido:

```bash
#!/usr/bin/env bash
#
# Deploy del Sistema de Ventas de Rifas a Google Cloud Run.
# Lee .env.local para los valores NO secretos. Los secretos
# (TURSO_AUTH_TOKEN, MERCADO_PAGO_ACCESS_TOKEN, MERCADO_PAGO_CLIENT_SECRET,
# MERCADO_PAGO_WEBHOOK_SECRET) viven en Secret Manager.
#
# Uso: ./scripts/deploy.sh
#
set -euo pipefail

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
  --set-secrets="TURSO_AUTH_TOKEN=turso-auth-token:latest,MERCADO_PAGO_ACCESS_TOKEN=mp-access-token:latest,MERCADO_PAGO_CLIENT_SECRET=mp-client-secret:latest,MERCADO_PAGO_WEBHOOK_SECRET=mp-webhook-secret:latest"

echo ""
echo "✅ Deploy listo. URL pública:"
gcloud run services describe "$SERVICE" \
  --region="$REGION" --project="$PROJECT" \
  --format='value(status.url)'
```

- [ ] **Step 3: Hacer el script ejecutable**

```bash
chmod +x scripts/deploy.sh
ls -la scripts/deploy.sh
```
Resultado esperado: permisos `-rwxr-xr-x` (las x indican ejecutable).

- [ ] **Step 4: Commit del script**

```bash
git add scripts/deploy.sh
git commit -m "feat(deploy): añadir scripts/deploy.sh para Cloud Run

Wrapper sobre 'gcloud run deploy --source .'. Lee .env.local para las
4 env vars no-secretas (TURSO_DATABASE_URL, MERCADO_PAGO_PUBLIC_KEY,
MERCADO_PAGO_CLIENT_ID, NEXT_PUBLIC_BASE_URL). Los 4 tokens críticos
vienen de Secret Manager via --set-secrets. Valida vars antes de
deployar y muestra la URL pública al final."
```

---

## Task 3: Setup GCP — Verificar billing y crear proyecto

**Files:** ninguno modificado en el repo. Comandos `gcloud` only.

- [ ] **Step 1: Confirmar cuenta activa en gcloud**

```bash
gcloud auth list
```
Resultado esperado: `intellego.ok@gmail.com` aparece con `*` (active). Si no, ejecutar:
```bash
gcloud config set account intellego.ok@gmail.com
```

- [ ] **Step 2: Listar billing accounts disponibles**

```bash
gcloud beta billing accounts list
```
Resultado esperado: al menos una fila con `OPEN: True`. Anotar el `ACCOUNT_ID` (formato `0X0X0X-XXXXXX-XXXXXX`).

> **Si NO hay billing accounts** o todas están `OPEN: False`: ir a https://console.cloud.google.com/billing/create, crear una billing account (requiere tarjeta de crédito; $0 cargo si no salimos del free tier), y volver a este step.

- [ ] **Step 3: Crear el proyecto GCP**

```bash
gcloud projects create sistema-ventas-rifas-prod \
  --name="Sistema Ventas Rifas"
```
Resultado esperado: `Operation "operations/cp.<ID>" finished successfully.` Si el proyecto ya existe o el nombre está tomado, el comando falla con error explícito.

- [ ] **Step 4: Setear el proyecto como default y verificar**

```bash
gcloud config set project sistema-ventas-rifas-prod
gcloud config get-value project
```
Resultado esperado: `sistema-ventas-rifas-prod`.

- [ ] **Step 5: Asociar billing account al proyecto**

Reemplazar `<BILLING_ACCOUNT_ID>` con el ID anotado en Step 2:

```bash
gcloud beta billing projects link sistema-ventas-rifas-prod \
  --billing-account=<BILLING_ACCOUNT_ID>
```
Resultado esperado: `billingAccountName: billingAccounts/<ID>` y `billingEnabled: true`.

- [ ] **Step 6: Verificar billing activo en el proyecto**

```bash
gcloud beta billing projects describe sistema-ventas-rifas-prod
```
Resultado esperado: `billingEnabled: true`. Si dice `false`, repetir Step 5.

---

## Task 4: Setup GCP — Habilitar APIs y crear Artifact Registry

**Files:** ninguno modificado en el repo.

- [ ] **Step 1: Habilitar las 4 APIs necesarias**

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project=sistema-ventas-rifas-prod
```
Tiempo: ~1-2 minutos. Resultado esperado: `Operation "operations/acat.<ID>" finished successfully.`

- [ ] **Step 2: Confirmar APIs habilitadas**

```bash
gcloud services list --enabled --project=sistema-ventas-rifas-prod \
  --filter="name:(run.googleapis.com OR cloudbuild.googleapis.com OR artifactregistry.googleapis.com OR secretmanager.googleapis.com)" \
  --format="value(name)"
```
Resultado esperado: las 4 líneas:
```
artifactregistry.googleapis.com
cloudbuild.googleapis.com
run.googleapis.com
secretmanager.googleapis.com
```

- [ ] **Step 3: Crear repositorio Docker en Artifact Registry**

```bash
gcloud artifacts repositories create app \
  --repository-format=docker \
  --location=us-east1 \
  --description="Imágenes container del Sistema de Ventas de Rifas" \
  --project=sistema-ventas-rifas-prod
```
Resultado esperado: `Created repository [app].`

- [ ] **Step 4: Configurar cleanup policy (mantener últimas 3 imágenes, borrar > 30 días)**

Crear archivo temporal con la política:

```bash
cat > /tmp/cleanup-policy.json <<'EOF'
[
  {
    "name": "keep-latest-3",
    "action": {"type": "Keep"},
    "mostRecentVersions": {"keepCount": 3}
  },
  {
    "name": "delete-old",
    "action": {"type": "Delete"},
    "condition": {"olderThan": "30d"}
  }
]
EOF

gcloud artifacts repositories set-cleanup-policies app \
  --location=us-east1 \
  --project=sistema-ventas-rifas-prod \
  --policy=/tmp/cleanup-policy.json

rm /tmp/cleanup-policy.json
```
Resultado esperado: confirmación de policy aplicada.

- [ ] **Step 5: Verificar repositorio listo**

```bash
gcloud artifacts repositories describe app \
  --location=us-east1 \
  --project=sistema-ventas-rifas-prod
```
Resultado esperado: incluye `format: DOCKER`, `mode: STANDARD_REPOSITORY`, `cleanupPolicies` con las 2 políticas.

---

## Task 5: Setup GCP — Crear secrets y permisos

**Files:** lee `.env.local` (no commiteado). Sin cambios al repo.

- [ ] **Step 1: Cargar variables del `.env.local` al shell**

```bash
set -a
source .env.local
set +a
```

Validar que las 4 secretas están presentes:
```bash
for v in TURSO_AUTH_TOKEN MERCADO_PAGO_ACCESS_TOKEN MERCADO_PAGO_CLIENT_SECRET MERCADO_PAGO_WEBHOOK_SECRET; do
  if [ -z "${!v:-}" ]; then
    echo "FALTA: $v"
  else
    val="${!v}"
    echo "OK: $v (longitud ${#val})"
  fi
done
```
Resultado esperado: 4 líneas con `OK: ...`. Si alguna dice "FALTA", recuperar el valor y agregarlo a `.env.local`.

- [ ] **Step 2: Crear secret `turso-auth-token`**

```bash
echo -n "$TURSO_AUTH_TOKEN" | gcloud secrets create turso-auth-token \
  --data-file=- \
  --replication-policy=automatic \
  --project=sistema-ventas-rifas-prod
```
Resultado esperado: `Created secret [turso-auth-token].` y `Created version [1] of the secret [turso-auth-token].`

- [ ] **Step 3: Crear secret `mp-access-token`**

```bash
echo -n "$MERCADO_PAGO_ACCESS_TOKEN" | gcloud secrets create mp-access-token \
  --data-file=- \
  --replication-policy=automatic \
  --project=sistema-ventas-rifas-prod
```

- [ ] **Step 4: Crear secret `mp-client-secret`**

```bash
echo -n "$MERCADO_PAGO_CLIENT_SECRET" | gcloud secrets create mp-client-secret \
  --data-file=- \
  --replication-policy=automatic \
  --project=sistema-ventas-rifas-prod
```

- [ ] **Step 5: Crear secret `mp-webhook-secret`**

```bash
echo -n "$MERCADO_PAGO_WEBHOOK_SECRET" | gcloud secrets create mp-webhook-secret \
  --data-file=- \
  --replication-policy=automatic \
  --project=sistema-ventas-rifas-prod
```

- [ ] **Step 6: Verificar los 4 secrets creados**

```bash
gcloud secrets list --project=sistema-ventas-rifas-prod --format="value(name)"
```
Resultado esperado: 4 líneas con los nombres exactos:
```
mp-access-token
mp-client-secret
mp-webhook-secret
turso-auth-token
```

- [ ] **Step 7: Otorgar permiso `secretAccessor` al service account de Cloud Run**

```bash
PROJECT_NUMBER=$(gcloud projects describe sistema-ventas-rifas-prod --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in turso-auth-token mp-access-token mp-client-secret mp-webhook-secret; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=sistema-ventas-rifas-prod
done
```
Resultado esperado: 4 bloques de output con `bindings:` mostrando el binding agregado.

- [ ] **Step 8: Verificar permisos asignados**

```bash
for SECRET in turso-auth-token mp-access-token mp-client-secret mp-webhook-secret; do
  echo "=== $SECRET ==="
  gcloud secrets get-iam-policy "$SECRET" --project=sistema-ventas-rifas-prod \
    --format="value(bindings.members)"
done
```
Resultado esperado: 4 secrets, cada uno listando el service account `<PROJECT_NUMBER>-compute@developer.gserviceaccount.com` con role `roles/secretmanager.secretAccessor`.

---

## Task 6: Primer deploy con placeholder URL

**Files:**
- Modify (temporal, no commitear): `.env.local`

- [ ] **Step 1: Setear `NEXT_PUBLIC_BASE_URL` con placeholder en `.env.local`**

Abrir `.env.local` y reemplazar la línea de `NEXT_PUBLIC_BASE_URL` por:
```
NEXT_PUBLIC_BASE_URL=https://placeholder-pre-cloud-run.invalid
```

> Esto NO se commitea (`.env.local` está en `.gitignore`). Es solo para que el primer deploy levante; el segundo deploy actualiza con la URL real.

- [ ] **Step 2: Ejecutar el primer deploy**

```bash
./scripts/deploy.sh
```
Tiempo: ~3-5 minutos (Cloud Build sube código → builda Dockerfile → push imagen → actualiza service).

Resultado esperado al final:
```
✅ Deploy listo. URL pública:
https://sistema-ventas-rifas-<HASH>.us-east1.run.app
```

> Si Cloud Build falla, revisar logs con:
> ```bash
> gcloud builds list --project=sistema-ventas-rifas-prod --limit=1 --format="value(id)"
> # Tomar el ID y:
> gcloud builds log <BUILD_ID> --project=sistema-ventas-rifas-prod
> ```

- [ ] **Step 3: Capturar y guardar la URL real**

```bash
SERVICE_URL=$(gcloud run services describe sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --format='value(status.url)')
echo "URL real del servicio: $SERVICE_URL"
```
Anotar `$SERVICE_URL` — se usa en Task 7.

- [ ] **Step 4: Verificar que el servicio está READY (aunque la URL apunte a placeholder en el cliente)**

```bash
gcloud run services describe sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --format="value(status.conditions[0].type,status.conditions[0].status)"
```
Resultado esperado: `Ready    True`.

- [ ] **Step 5: Sanity check HTTP del servicio**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$SERVICE_URL/"
```
Resultado esperado: `HTTP 200`.

> Si HTTP 500, revisar logs:
> ```bash
> gcloud run services logs read sistema-ventas-rifas \
>   --region=us-east1 --project=sistema-ventas-rifas-prod --limit=30
> ```
> Causas típicas: env var faltante, secret sin permiso, schema BD desincronizado.

---

## Task 7: Segundo deploy con URL real

**Files:**
- Modify: `.env.local` (no commitear)

- [ ] **Step 1: Actualizar `.env.local` con la URL real capturada en Task 6**

Si el shell sigue abierto y `$SERVICE_URL` está definida (Task 6 Step 3), usar ese valor. Si abriste nueva terminal, recapturar:
```bash
SERVICE_URL=$(gcloud run services describe sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --format='value(status.url)')
echo "$SERVICE_URL"
```

Editar `.env.local` y reemplazar la línea `NEXT_PUBLIC_BASE_URL=...` por el valor de `$SERVICE_URL` (sin slash final). Ejemplo:
```
NEXT_PUBLIC_BASE_URL=https://sistema-ventas-rifas-abc123def4.us-east1.run.app
```

- [ ] **Step 2: Re-ejecutar el deploy**

```bash
./scripts/deploy.sh
```
Tiempo: ~2-3 min (caché de Cloud Build acelera el segundo build).

Resultado esperado: el script termina con la misma URL pública.

- [ ] **Step 3: Verificar que `NEXT_PUBLIC_BASE_URL` quedó actualizado en el servicio**

```bash
gcloud run services describe sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --format="value(spec.template.spec.containers[0].env)" | grep NEXT_PUBLIC
```
Resultado esperado: la línea muestra el value de `NEXT_PUBLIC_BASE_URL` igual a la URL real (NO `placeholder-pre-cloud-run.invalid`).

---

## Task 8: Smoke tests post-deploy

**Files:** ninguno modificado.

- [ ] **Step 1: Capturar URL en variable shell**

```bash
URL=$(gcloud run services describe sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --format='value(status.url)')
echo "Probando contra: $URL"
```

- [ ] **Step 2: Test 1 — Servicio responde con HTTP 200**

```bash
curl -s -o /dev/null -w "HTTP %{http_code} (%{time_total}s)\n" "$URL/"
```
Resultado esperado: `HTTP 200` con tiempo < 5s (el primero puede ser cold start).

- [ ] **Step 3: Test 2 — API toca BD correctamente**

```bash
curl -s "$URL/api/raffle/config" | jq .
```
Resultado esperado: JSON con campos `id`, `title`, `pricePerNumber`, `totalNumbers`, `status`. Por ahora aún muestra "Rifa Escolar 2025" (la BD productiva no se tocó). Eso CONFIRMA que la conexión a Turso funciona y los secrets cargaron OK.

> Si devuelve `{"error":"..."}` o HTTP 500, casi seguro es problema de secret. Revisar:
> ```bash
> gcloud run services logs read sistema-ventas-rifas \
>   --region=us-east1 --project=sistema-ventas-rifas-prod --limit=30 | grep -iE "error|denied|secret"
> ```

- [ ] **Step 4: Test 3 — Endpoint de verificación de números (read-only)**

```bash
curl -s -X POST "$URL/api/numbers/verify" \
  -H "Content-Type: application/json" \
  -d '{"numbers":[1,2,3]}' | jq .
```
Resultado esperado: JSON con info de availability de los números 1, 2 y 3 (probablemente `unavailable` si fueron vendidos en 2025).

- [ ] **Step 5: Test 4 — Logs limpios (sin errores rojos en últimos 50 events)**

```bash
gcloud run services logs read sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod --limit=50 \
  | grep -iE "error|fatal|exception|denied" || echo "✅ Sin errores en últimos 50 logs"
```
Resultado esperado: `✅ Sin errores en últimos 50 logs` (el `|| echo` se imprime cuando grep no encuentra matches).

- [ ] **Step 6: Test 5 (opcional) — Datar baseline de cold start**

Solo si querés tener métrica documentada. Esperar 16 min sin tocar el servicio (la instancia escala a 0 luego de ~15 min de inactividad), después:
```bash
sleep 1000  # ~17 min — solo si querés datar baseline; podés saltear
time curl -s -o /dev/null "$URL/"
```
Resultado esperado: tiempo total < 5s en cold start, < 200ms en requests subsiguientes. **No bloquea el cutover si lo salteás.**

---

## Task 9: Cutover del webhook MercadoPago

**Files:** ninguno modificado en el repo. Operación manual en MP dashboard.

- [ ] **Step 1: Anotar la URL completa del webhook**

```bash
echo "Nueva URL del webhook: $URL/api/webhooks/mercadopago"
```
Copiar el valor (formato `https://sistema-ventas-rifas-<HASH>.us-east1.run.app/api/webhooks/mercadopago`).

- [ ] **Step 2: Login en panel de MercadoPago Developers**

Abrir https://www.mercadopago.com.ar/developers/panel/app en el browser. Iniciar sesión con la cuenta que tiene el `MERCADO_PAGO_ACCESS_TOKEN` activo (la cuenta es `RODRIGODIBERNARDO`, id 103052976, según la verificación ejecutada el 2026-05-01).

- [ ] **Step 3: Navegar a la app "Rifas" → Notificaciones / Webhooks**

Click en la app correspondiente al `MERCADO_PAGO_CLIENT_ID` (`37964915...`). Después navegar al menú **Notificaciones** o **Webhooks** (la UI de MP cambia el nombre cada tanto).

- [ ] **Step 4: Editar la URL del webhook**

- URL anterior: `https://sistema-ventas-rifas.vercel.app/api/webhooks/mercadopago`
- URL nueva (la copiada en Step 1).

Guardar el cambio. Confirmar que el secret de webhook (`MERCADO_PAGO_WEBHOOK_SECRET`) sigue siendo el mismo — NO regenerarlo en este paso.

- [ ] **Step 5: Disparar "Simular notificación" desde MP**

Desde el mismo panel, hay un botón "Simular notificación" o "Test webhook". Disparar una notificación de prueba (cualquier evento — payment.created, etc.).

- [ ] **Step 6: Verificar HTTP 200 desde Cloud Run**

```bash
gcloud run services logs read sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --limit=20 | grep -iE "webhook|/api/webhooks/mercadopago"
```
Resultado esperado: una entrada reciente con `POST /api/webhooks/mercadopago` y status `200`.

- [ ] **Step 7: Verificar que la firma HMAC validó correctamente**

```bash
gcloud run services logs read sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --limit=50 | grep -iE "signature|HMAC|webhook"
```
Resultado esperado: NO aparece ningún log de "Invalid signature", "401", o "signature mismatch".

> Si la firma falla, el `MERCADO_PAGO_WEBHOOK_SECRET` en Secret Manager difiere del que MP usa para firmar. Verificar coincidencia y, si necesario:
> ```bash
> echo -n "<SECRET_NUEVO_DEL_DASHBOARD_MP>" | gcloud secrets versions add mp-webhook-secret \
>   --data-file=- --project=sistema-ventas-rifas-prod
> ./scripts/deploy.sh   # redeploy para que tome la versión nueva
> ```

---

## Task 10: Documentación de gestión

**Files:**
- Modify: `CLAUDE.md`
- Modify: `MEMORIA.md`
- Modify: `ESTADO.md`
- Modify: `BUGS.md`
- Modify: `LEARNINGS.md`
- Rename + rewrite: `.claude/commands/deploy-vercel.md` → `.claude/commands/deploy.md`

- [ ] **Step 1: Update `CLAUDE.md` — sección Overview**

Buscar la línea:
```
- Auto-deploy on push to main vía GitHub → Vercel pipeline
```
Reemplazar por:
```
- Deploy manual a Google Cloud Run (us-east1) vía `./scripts/deploy.sh` — sin auto-deploy
```

Buscar el bloque:
```
- Producción: https://sistema-ventas-rifas.vercel.app
```
Reemplazar por (con la URL real capturada en Task 6):
```
- Producción: https://sistema-ventas-rifas-<HASH>.us-east1.run.app (Cloud Run, us-east1, proyecto sistema-ventas-rifas-prod)
```

- [ ] **Step 2: Update `CLAUDE.md` — sección Tech Stack**

Buscar:
```
- Hosting: Vercel (preview + production)
```
Reemplazar por:
```
- Hosting: Google Cloud Run (us-east1, proyecto sistema-ventas-rifas-prod, account intellego.ok@gmail.com)
- Container: Docker multi-stage Node 20 alpine, imagen ~150 MB en Artifact Registry
- Secrets: Google Secret Manager (4 secrets críticos), env vars planas para los 4 valores públicos
```

- [ ] **Step 3: Update `CLAUDE.md` — sección Commands**

Buscar el bloque que empieza con `# Deploy` y termina antes de `# Session Management`. Reemplazarlo por:
```
# Deploy (Cloud Run)
./scripts/deploy.sh                                  # build + deploy a producción
gcloud run services describe sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod  # estado actual
gcloud run services logs read sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod --limit=50  # logs

# Secret Manager
gcloud secrets versions add <SECRET_NAME> --data-file=- --project=sistema-ventas-rifas-prod  # rotar secret
gcloud secrets list --project=sistema-ventas-rifas-prod                                       # listar
```

- [ ] **Step 4: Update `CLAUDE.md` — sección Critical Rules**

En el bloque "Reglas de Workflow", agregar al final:
```
- ❌ NUNCA correr `gcloud projects delete sistema-ventas-rifas-prod` ni `gcloud run services delete sistema-ventas-rifas` durante venta activa
- ❌ NUNCA editar valores en Secret Manager directamente desde Console UI; usar `gcloud secrets versions add` y forzar redeploy
- ❌ NUNCA commitear `scripts/deploy.sh` con valores hardcodeados; siempre leer de `.env.local`
```

- [ ] **Step 5: Update `CLAUDE.md` — sección MCP Usage**

Reemplazar la fila de "vercel" en la tabla por:
```
| **gcloud** | Deploy, logs, secret management, billing | dashboard GCP |
```

- [ ] **Step 6: Update `MEMORIA.md` — agregar nueva sesión**

Después de la sesión "Sesión 1 — 2026-05-01 (verificación técnica post-pausa)" y antes de "Sesión 0 — 2026-05-01 (reactivación + modernización)", agregar:

```markdown
### Sesión 2 — 2026-05-02 (migración Vercel → Cloud Run)
- **Duración aproximada**: ~3h
- **Resumen**: Diagnóstico del pause de Vercel + decisión de migración + ejecución completa.
- **Logros**:
  - Diagnóstico Vercel: workspace pausado (hipótesis: detección automática de uso comercial), proyecto `sistema-ventas-rifas` eliminado, sin invoice impaga, caps de uso todos OK
  - Brainstorming con 7 decisiones documentadas en `docs/superpowers/specs/2026-05-02-migracion-cloud-run-design.md`
  - Plan de implementación en `docs/superpowers/plans/2026-05-02-migracion-cloud-run.md`
  - Containerización: Dockerfile multi-stage Node 20 alpine + `.dockerignore` + `output: 'standalone'` en next.config.js
  - Setup GCP: proyecto `sistema-ventas-rifas-prod`, billing asociado, 4 APIs habilitadas (run/cloudbuild/artifactregistry/secretmanager), repo Artifact Registry `app` con cleanup policy
  - Secret Manager: 4 secrets (turso-auth-token, mp-access-token, mp-client-secret, mp-webhook-secret) con permiso secretAccessor al SA de Cloud Run
  - Deploy en `us-east1`, min 0 / max 10, 512Mi / 1 vCPU, allow-unauthenticated
  - Smoke tests pasados: HTTP 200, /api/raffle/config conecta a Turso, /api/numbers/verify responde, logs limpios
  - Webhook MP migrado a la nueva URL; "Simular notificación" devolvió 200 con firma OK
- **Problemas encontrados**: BUG-007 (Vercel auto-pause)
- **Estado al cerrar**: Servicio Cloud Run productivo en `<URL>`. Costo acumulado GCP: $0. Próxima tarea: 1.5 (smoke test del flujo completo en sandbox MP).
```

Adicionalmente, en la sección "Notas Importantes" reemplazar la línea de Vercel por:
```
- **Hosting**: Cloud Run en `us-east1` (proyecto `sistema-ventas-rifas-prod`, account `intellego.ok@gmail.com`). 100% Free Tier.
```

- [ ] **Step 7: Update `ESTADO.md` — checklist + bitácora**

En sección "Fase 1: Reactivación técnica":
- Marcar 1.4 como `[x]` (verificación deploy se hizo en Cloud Run en lugar de Vercel)

En sección "Bitácora", insertar al inicio (después del título "## Bitácora"):

```markdown
### 2026-05-02 — Migración Vercel → Cloud Run completada
- **Resumen**: Cuenta Vercel del usuario quedó pausada por flag de uso comercial; proyecto eliminado por la pausa. Migración completa a Google Cloud Run (us-east1) bajo cuenta intellego.ok@gmail.com.
- **Tareas completadas**: 1.4
- **Acciones**:
  - Spec: `docs/superpowers/specs/2026-05-02-migracion-cloud-run-design.md`
  - Plan: `docs/superpowers/plans/2026-05-02-migracion-cloud-run.md`
  - Repo: `Dockerfile`, `.dockerignore`, `scripts/deploy.sh` nuevos; `next.config.js` con `output: 'standalone'`
  - GCP: proyecto `sistema-ventas-rifas-prod` con billing, 4 APIs habilitadas, Artifact Registry `app` con cleanup policy, 4 secrets en Secret Manager, Cloud Run service `sistema-ventas-rifas` en `us-east1`
  - Smoke tests OK: HTTP 200, `/api/raffle/config` conecta a Turso, logs sin errores
  - Webhook MP actualizado a la URL nueva, simulación devolvió 200
- **Próxima tarea**: 1.5 — `npm run dev` local + smoke test del flujo completo en sandbox MP
- **Archivos modificados**: ver Plan + meta-docs (CLAUDE/MEMORIA/ESTADO/BUGS/LEARNINGS) + `.claude/commands/deploy.md`
```

En sección "Próxima tarea" al final del archivo, reemplazar por:
```markdown
**1.5** — `npm run dev` local + smoke test del flujo completo en sandbox MP, validando que la integración Cloud Run + Turso + MP no tiene regresiones.
```

- [ ] **Step 8: Update `BUGS.md` — agregar BUG-007**

En sección "Resumen", actualizar:
- "Total bugs registrados": 7
- "Resueltos": 7

Después del bloque BUG-006 (resuelto), agregar:

```markdown
### BUG-007 | RESUELTO
- **Fecha detectado**: 2026-05-01
- **Descripción**: Workspace de Vercel `rodrigodibernardo-gmailcoms-projects` quedó en estado `Paused`; el proyecto `sistema-ventas-rifas` fue eliminado del workspace. La URL pública `sistema-ventas-rifas.vercel.app` devolvió HTTP 404 con `x-vercel-error: DEPLOYMENT_NOT_FOUND`.
- **Contexto**: Sesión de reactivación 2026-05-01, intento de verificar deploy productivo (tarea 1.4)
- **Error/Síntoma**: Sitio caído. Dashboard de Vercel muestra badge "Paused" en el workspace, "Upgrade to resume service" como única acción ofrecida. No hay botón "Resume" / "Unpause" en ninguna parte de la UI.
- **Causa raíz**: Hipótesis dominante — detección automática de uso comercial. Vercel endureció en 2024-2026 la cláusula "no commercial use" del plan Hobby; una rifa con MercadoPago integrado y operación 2025 con $4M ARS proyectados encajó en el flag. Caps de uso descartados (todos < 1% del límite); sin invoices pendientes; Speed Insights activado en Hobby (que requiere Pro) probablemente fue un disparador secundario.
- **Solución aplicada**: Migración completa a Google Cloud Run en `us-east1` bajo cuenta `intellego.ok@gmail.com` (proyecto nuevo `sistema-ventas-rifas-prod`). Mantiene 100% Free Tier. Documentado en `docs/superpowers/specs/2026-05-02-migracion-cloud-run-design.md`.
- **Archivos afectados**: `next.config.js`, nuevos `Dockerfile`, `.dockerignore`, `scripts/deploy.sh`. Renombrado `.claude/commands/deploy-vercel.md` → `.claude/commands/deploy.md`. Actualizados todos los meta-docs.
- **Fecha resuelto**: 2026-05-02
```

- [ ] **Step 9: Update `LEARNINGS.md` — 4 aprendizajes nuevos**

Antes de la sección "### 2026-05-01 — Tarea 1.1 (npm audit + bump de seguridad)", agregar:

```markdown
### 2026-05-02 — Migración Vercel → Cloud Run

- **2026-05-02** Convención técnica — Vercel Hobby Tier (gratis) auto-pausa workspaces que detecta como "uso comercial" (apps con e-commerce/payments/cobranzas). El estado pausado es **terminal**: no hay botón "Resume" en la UI; solo "Upgrade to Pro $20/mes". El proyecto puede ser eliminado en el proceso. Para apps que mueven dinero, NO confiar en Vercel Hobby como hosting productivo. _(Destino: solo registro)_ _(Origen: BUG-007)_

- **2026-05-02** Técnico — Cloud Run free tier mensual: 2M requests, 360K GB-seconds, 180K vCPU-seconds. Para una app con tráfico bajo (rifa local, cientos de visitas/día), el free tier cubre ampliamente. Restricción operativa: `--min-instances=0` (escala a cero) para no incurrir en costos por instancias warm; cold start de 2-5s aceptable porque el webhook MP tiene retry policy de 3 intentos en ~22 min. _(Destino: solo registro)_ _(Origen: setup migración)_

- **2026-05-02** Convención técnica — Latencia de Turso desde Cloud Run depende fuertemente de la región. Turso primary está en AWS us-east-1 (IP `52.71.235.0`). Cloud Run en `us-east1` (South Carolina) → Turso ~5-10ms; Cloud Run en `southamerica-east1` (São Paulo, más cerca del usuario AR) → Turso ~150ms. Para apps con transacciones anti-sobreventa críticas, priorizar latencia con la BD por sobre latencia con el usuario. _(Destino: solo registro)_ _(Origen: brainstorming migración)_

- **2026-05-02** Herramienta — Sin Docker local, `gcloud run deploy --source .` delega el build a Cloud Build remoto usando el `Dockerfile` del repo. Archivos a NO copiar al build context: `node_modules`, `.next`, `.git`, `.env*`, `docs/`, `old_docs/`, `.claude/`, scripts de test (`test-*.js`, `run-*.js`). Configurar en `.dockerignore`. Imagen final con `output: 'standalone'` de Next.js: ~150 MB (vs ~300-400 MB con Buildpacks). Mantenerla así para no exceder el free tier de 0.5 GB de Artifact Registry. _(Destino: solo registro)_ _(Origen: implementación migración)_
```

- [ ] **Step 10: Renombrar y reescribir `.claude/commands/deploy-vercel.md`**

```bash
git mv .claude/commands/deploy-vercel.md .claude/commands/deploy.md
```

Reemplazar todo el contenido del archivo `.claude/commands/deploy.md` por:

```markdown
# Comando /deploy — Sistema de Ventas de Rifas (Cloud Run)

## Propósito
Ejecutar el pipeline de deploy a Google Cloud Run con verificaciones previas. Bloquea el deploy si lint, build o secrets fallan.

## INSTRUCCIONES PARA CLAUDE CODE

Cuando el usuario ejecute `/deploy`, seguí estos pasos EN ORDEN:

### PASO 0: Pre-flight checks
```bash
# Cuenta gcloud activa correcta
ACTIVE=$(gcloud config get-value account)
[ "$ACTIVE" = "intellego.ok@gmail.com" ] || echo "⚠️ Cuenta activa: $ACTIVE (esperado: intellego.ok@gmail.com)"

# Proyecto correcto
PROJECT=$(gcloud config get-value project)
[ "$PROJECT" = "sistema-ventas-rifas-prod" ] || echo "⚠️ Proyecto activo: $PROJECT"

# .env.local existe
[ -f .env.local ] && echo "✅ .env.local presente" || echo "❌ FALTA .env.local"

# scripts/deploy.sh ejecutable
[ -x scripts/deploy.sh ] && echo "✅ deploy.sh ejecutable" || echo "❌ FALTA chmod +x scripts/deploy.sh"
```

Si algo falla, **NO continuar**: pedir al usuario que arregle el preflight.

### PASO 1: Validación local
```bash
npm run lint   # debe pasar (warnings de exhaustive-deps OK)
npm run build  # debe generar .next/standalone/server.js
test -f .next/standalone/server.js && echo "✅ standalone OK"
```
Si lint o build fallan, **NO continuar**.

### PASO 2: Confirmar con el usuario
Si la rifa está activa (status='active' en tabla `raffles`), **PREGUNTAR EXPLÍCITAMENTE**:
```
⚠️ La rifa está activa. ¿Confirmás que querés deployar AHORA?
Recordá la regla crítica: "NUNCA pushear cambios al flujo de pago durante horario de venta activa".
```
Si responde no, abortar.

### PASO 3: Ejecutar deploy
```bash
./scripts/deploy.sh
```

### PASO 4: Smoke tests post-deploy
```bash
URL=$(gcloud run services describe sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --format='value(status.url)')

curl -s -o /dev/null -w "HTTP %{http_code}\n" "$URL/"                    # esperado 200
curl -s "$URL/api/raffle/config" | jq -e '.id' > /dev/null && echo "✅ config OK"
gcloud run services logs read sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod --limit=30 \
  | grep -iE "error|fatal" || echo "✅ logs limpios"
```

### PASO 5: Reportar al usuario
```
✅ Deploy exitoso a Cloud Run.
🌐 URL: <URL>
📊 Smoke tests: HTTP 200, BD conecta, logs limpios.
📝 Recordá actualizar ESTADO.md con /save si esto fue parte de una tarea trackeable.
```

## Reglas críticas
1. NUNCA deployar sin haber pasado lint + build localmente.
2. NUNCA deployar durante horario de venta activa sin confirmación explícita.
3. NUNCA usar `gcloud run deploy` con flags distintos a los del script (rompe set de env vars/secrets si se omite alguno).
4. Si Cloud Build falla, leer logs con `gcloud builds log <BUILD_ID>` antes de re-intentar.
```

- [ ] **Step 11: Verificar que el spec y plan ya están commiteados o commitearlos**

```bash
git status docs/superpowers/
```

Si aparecen sin trackear:
```bash
git add docs/superpowers/specs/2026-05-02-migracion-cloud-run-design.md \
        docs/superpowers/plans/2026-05-02-migracion-cloud-run.md
git commit -m "docs(superpowers): spec + plan de migración Vercel → Cloud Run"
```

- [ ] **Step 12: Commit final de docs de gestión + comando renombrado**

```bash
git add CLAUDE.md MEMORIA.md ESTADO.md BUGS.md LEARNINGS.md \
        .claude/commands/deploy.md .claude/commands/deploy-vercel.md
git status   # confirmar que .claude/commands/deploy-vercel.md aparece como deleted (efecto del git mv)
git commit -m "docs(migracion): actualizar meta-docs + renombrar /deploy-vercel a /deploy

Migración Vercel → Cloud Run finalizada.
- CLAUDE.md: sección Hosting/Commands/Critical Rules adaptada a Cloud Run
- MEMORIA.md: nueva sesión 2 (2026-05-02) con resumen de migración
- ESTADO.md: 1.4 marcada cumplida, bitácora actualizada
- BUGS.md: BUG-007 documentado y cerrado
- LEARNINGS.md: 4 aprendizajes nuevos sobre Vercel auto-pause, Cloud Run free tier, latencia Turso/región, gcloud deploy --source
- .claude/commands/deploy.md: comando reescrito para pipeline Cloud Run"
```

- [ ] **Step 13: Verificar estado final**

```bash
git log --oneline -5
git status   # debe estar clean
```
Resultado esperado:
- 4 commits nuevos (Task 1, Task 2, spec/plan, docs final).
- Working tree clean.

---

## Criterios de éxito (gate final)

Antes de declarar la migración completa, verificar uno por uno:

- [ ] `npm run lint` pasa sin errores.
- [ ] `npm run build` genera `.next/standalone/server.js`.
- [ ] `gcloud run services describe sistema-ventas-rifas --region=us-east1` retorna `Ready: True`.
- [ ] `curl https://sistema-ventas-rifas-<HASH>.us-east1.run.app/` → HTTP 200.
- [ ] `curl https://sistema-ventas-rifas-<HASH>.us-east1.run.app/api/raffle/config` → JSON válido con campos del schema raffles.
- [ ] Webhook URL en MP dashboard apunta a la nueva URL.
- [ ] "Simular notificación" desde MP → HTTP 200 + firma HMAC OK en logs.
- [ ] CLAUDE.md, MEMORIA.md, ESTADO.md, BUGS.md, LEARNINGS.md actualizados y commiteados.
- [ ] `.claude/commands/deploy.md` existe y `.claude/commands/deploy-vercel.md` no.
- [ ] Costo acumulado en GCP billing dashboard = $0.

Si todo en verde, la migración se considera completa y el sistema está listo para Fase 1.5 (smoke test del flujo completo en sandbox MP).

---

## Rollback plan (si algo sale catastróficamente mal)

El proyecto Vercel ya no existe — no hay path de rollback hacia allá. Las opciones de recovery si Cloud Run falla:

1. **Deploy fix-forward**: arreglar el bug, redeployar con `./scripts/deploy.sh`. La revision anterior queda en Cloud Run y se puede ruteear tráfico hacia ella con `gcloud run services update-traffic`.
2. **Revertir a revision anterior** (si la nueva tiene bug y la anterior no):
   ```bash
   gcloud run services update-traffic sistema-ventas-rifas \
     --to-revisions=PREVIOUS_REVISION=100 \
     --region=us-east1 --project=sistema-ventas-rifas-prod
   ```
3. **Borrar el servicio** (último recurso, deja sitio caído mientras se diagnostica):
   ```bash
   gcloud run services delete sistema-ventas-rifas \
     --region=us-east1 --project=sistema-ventas-rifas-prod
   ```

> Durante venta activa, ANTES de borrar el servicio, comunicar a los compradores que la rifa está en pausa técnica. La BD Turso queda intacta — los números reservados se mantienen, las compras pendientes pueden cerrarse manualmente desde Turso Studio si el sitio sigue caído al expirar la reserva.
