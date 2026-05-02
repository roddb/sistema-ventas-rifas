# Migración Vercel → Google Cloud Run — Design Spec

- **Proyecto**: Sistema de Ventas de Rifas Escolares
- **Fecha**: 2026-05-02
- **Autor**: Rodrigo Di Bernardo (decisiones) + Claude (redacción)
- **Estado**: borrador, pendiente revisión final del usuario
- **Restricción dura**: 100% Free Tier (la plata recaudada se dona, presupuesto = $0)

---

## 1. Contexto y motivación

El workspace de Vercel `rodrigodibernardo-gmailcoms-projects` quedó en estado `Paused` y el proyecto `sistema-ventas-rifas` fue eliminado (devuelve `DEPLOYMENT_NOT_FOUND` desde la URL pública). Diagnóstico ejecutado el 2026-05-01 confirmó:

- Plan vigente: Hobby Active.
- Sin invoices pendientes; cuotas (Bandwidth, Edge Requests, Blob, ISR) todas < 1% de los caps.
- Único add-on Pro habilitado: Speed Insights ($10/mes/proyecto). El toggle no se puede apagar desde Hobby — al intentar apagarlo, la UI redirige al modal de upgrade.
- No existe botón "Resume" / "Unpause" en ninguna parte de la UI; la única acción ofrecida es "Upgrade to Pro" ($20 USD/mes).
- Los otros 4 proyectos del workspace (audioscribe, intellego-gestion-escolar, intellego-platform, fiame) también caen por el pause global.

Hipótesis dominante: detección automática de uso comercial — Vercel endureció en 2024-2026 la cláusula "no commercial use" del plan Hobby; una rifa con MercadoPago integrado y operación 2025 con $4M ARS proyectados encaja en el flag.

Como el proyecto fue **eliminado** (no solo desactivado), levantar el pause no recupera el deploy: hay que recrearlo igual. Eso colapsa la decisión "Vercel Pro vs migrar" en una sola: dado que hay que recrear, ¿dónde?

Cloud Run gana porque:
1. Free tier mensual cubre con holgura el tráfico esperado (2M requests, 360K GB-s, 180K vCPU-s).
2. No tiene cláusula de "uso comercial" — la rifa puede operar sin riesgo de pause arbitrario.
3. Cloud Run es portable a otros runtimes container — si mañana hay que migrar, el Dockerfile sirve.
4. La cuenta `intellego.ok@gmail.com` ya tiene gcloud CLI configurado y autenticado.

---

## 2. Decisiones tomadas durante el brainstorming

| # | Decisión | Justificación |
|---|---|---|
| 1 | Crear proyecto GCP nuevo `sistema-ventas-rifas-prod` (no reusar `intellego-platform-prod`) | Aislamiento real de blast radius: billing, IAM, quotas y secrets separados. Una app que mueve dinero merece su proyecto. Reversible (transferible/deletable) en un comando. |
| 2 | Deploy manual con `gcloud run deploy --source .` (sin CI/CD automatizado) | Cumple con la regla "NUNCA pushear cambios al flujo de pago durante horario de venta activa" (CLAUDE.md). Cero riesgo de deploy accidental. La rifa hace ~10 deploys totales en su vida útil — automatizar no paga. |
| 3 | Region `us-east1` | Turso primary está en AWS us-east-1 (Virginia, IP `52.71.235.0`). us-east1 → Turso = ~5-10ms latencia. southamerica-east1 (más cerca del usuario AR) sería ~150ms a Turso, malo para transacciones anti-sobreventa. |
| 4 | `min-instances=0` siempre (escala a cero) | Restricción "100% gratis": min=1 cuesta ~$5-7 USD/mes. Cold start de 2-5s es aceptable; no afecta sobreventa (la BD es la fuente de verdad) y MP webhook tiene retry de 3 intentos en ~22 min. |
| 5 | Secret Manager para los 4 tokens críticos (`turso-auth-token`, `mp-access-token`, `mp-client-secret`, `mp-webhook-secret`) + env vars planas para los 4 públicos (`TURSO_DATABASE_URL`, `MERCADO_PAGO_PUBLIC_KEY`, `MERCADO_PAGO_CLIENT_ID`, `NEXT_PUBLIC_BASE_URL`) | Práctica estándar producción. Audit log por secret, rotación independiente, IAM granular. Tokens NO aparecen en `gcloud run services describe` ni en logs de deploy. Free tier: 6 secret versions + 10K access ops/mes — sobrado. |
| 6 | URL default de Cloud Run (`https://sistema-ventas-rifas-<HASH>.us-east1.run.app` (formato exacto lo asigna Cloud Run en el primer deploy)), sin custom domain | Custom domain implica costo de dominio (~$12/año) si no hay uno disponible — incompatible con "100% gratis". Custom domain queda como mejora opcional Fase 4.5 si en el futuro hay dominio gratuito disponible. |
| 7 | Containerización con Dockerfile multi-stage (Node 20 alpine), no Buildpacks | Pin de Node version evita rupturas por upgrades automáticos del buildpack. Imagen final ~150 MB vs ~300-400 MB de buildpacks — mantiene Artifact Registry por debajo del cap free de 0.5 GB. Portable a otros runtimes container. |

---

## 3. Arquitectura

### 3.1 Request flow

```
┌─────────────┐     HTTPS      ┌────────────────────┐     ┌───────────────┐
│   Usuario   │ ─────────────> │   Cloud Run        │ ──> │  Turso (US-E) │
│ (browser AR)│                │   us-east1         │     │   libsql      │
└─────────────┘                │   sistema-ventas-  │     └───────────────┘
                               │   rifas            │
                               │   (min 0, max 10)  │     ┌───────────────┐
                               │                    │ ──> │  MercadoPago  │
                               │   Imagen:          │     │  API + Webhook│
                               │   us-east1-docker. │     └───────────────┘
                               │   pkg.dev/...      │            │
                               └────────────────────┘            │
                                       ▲                          │
                                       │ webhook IPN              │
                                       └──────────────────────────┘

┌─────────────────────────┐
│ Secret Manager          │   ← montados como env vars en runtime
│  • turso-auth-token     │
│  • mp-access-token      │
│  • mp-client-secret     │
│  • mp-webhook-secret    │
└─────────────────────────┘
```

### 3.2 Componentes nuevos en GCP

- **Proyecto**: `sistema-ventas-rifas-prod` con billing account asociado.
- **Cloud Run service**: `sistema-ventas-rifas` en `us-east1`, min 0 / max 10 instancias, 512 MB RAM, 1 vCPU, request timeout 60s, allow-unauthenticated.
- **Artifact Registry**: repositorio Docker `app` en `us-east1` con cleanup policy (mantener últimas 3 imágenes, borrar > 30 días).
- **Secret Manager**: 4 secrets con replicación automática.
- **APIs habilitadas**: `run.googleapis.com`, `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, `secretmanager.googleapis.com`.

### 3.3 Componentes existentes que NO se tocan

- **Turso**: misma BD productiva, mismas tablas, mismo auth token. Solo se referencia desde la nueva infra.
- **MercadoPago**: misma app, mismo access token PROD, mismo public key, mismo webhook secret. Único cambio operativo: actualizar URL del webhook desde el dashboard de MP.
- **Código de la app**: `app/`, `components/`, `lib/`, schema de Drizzle — sin cambios. Es Next.js estándar; corre igual en cualquier runtime Node.

---

## 4. Cambios al repositorio

### 4.1 Archivos nuevos

#### `Dockerfile`
Multi-stage build con Node 20 alpine. Final image ~150 MB.

```dockerfile
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

#### `.dockerignore`
Evita copiar artefactos pesados al build context, manteniendo builds rápidos y la imagen chica.

```
node_modules
.next
.git
.env*
*.md
old_docs/
docs/
.claude/
.vercel
*.log
*.csv
test-*.js
run-*.js
simple-*.js
```

#### `scripts/deploy.sh`
Script ejecutable que envuelve el comando `gcloud run deploy`. Lee `.env.local` para los valores no-secretos en runtime; los secretos vienen de Secret Manager. **Se commitea** (no contiene credenciales).

```bash
#!/usr/bin/env bash
set -euo pipefail

set -a
source .env.local
set +a

PROJECT="sistema-ventas-rifas-prod"
SERVICE="sistema-ventas-rifas"
REGION="us-east1"

gcloud run deploy "$SERVICE" \
  --source=. \
  --region="$REGION" \
  --project="$PROJECT" \
  --allow-unauthenticated \
  --min-instances=0 --max-instances=10 \
  --memory=512Mi --cpu=1 --timeout=60s \
  --set-env-vars="TURSO_DATABASE_URL=$TURSO_DATABASE_URL,MERCADO_PAGO_PUBLIC_KEY=$MERCADO_PAGO_PUBLIC_KEY,MERCADO_PAGO_CLIENT_ID=$MERCADO_PAGO_CLIENT_ID,NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL" \
  --set-secrets="TURSO_AUTH_TOKEN=turso-auth-token:latest,MERCADO_PAGO_ACCESS_TOKEN=mp-access-token:latest,MERCADO_PAGO_CLIENT_SECRET=mp-client-secret:latest,MERCADO_PAGO_WEBHOOK_SECRET=mp-webhook-secret:latest"

echo "✅ Deploy listo. URL:"
gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format='value(status.url)'
```

### 4.2 Archivos modificados

#### `next.config.js`
Agregar `output: 'standalone'` para que `npm run build` produzca `.next/standalone/server.js` con todas las deps necesarias bundleadas — clave para el Dockerfile multi-stage.

```js
const nextConfig = {
  output: 'standalone',  // ← nuevo
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

### 4.3 Archivos no tocados

- `package.json` — todas las deps actuales son compatibles con Node 20 runtime.
- `app/`, `components/`, `lib/`, `drizzle.config.ts` — sin cambios.
- `.env.local` — sigue siendo fuente de verdad para dev local.
- `.gitignore` — ya cubre `.env*`, no necesita updates.

### 4.4 Validación local antes del primer deploy

Sin Docker local, el sustituto es:
1. `npm run lint` (debe pasar).
2. `npm run build` (debe generar `.next/standalone/server.js`).
3. `node .next/standalone/server.js` con env vars exportadas — corre el build standalone localmente.

Si los 3 pasan, el deploy a Cloud Run pasa.

---

## 5. Setup GCP one-time

Ejecutados una sola vez al inicio. Usuario activo: `intellego.ok@gmail.com`.

### 5.1 Verificar billing account
```bash
gcloud beta billing accounts list
```
Debe haber al menos un billing account activo. Si no, el usuario crea uno desde https://console.cloud.google.com/billing/create (5 min, requiere tarjeta, $0 cargo dentro del free tier). **Bloqueante**: sin billing account no se puede crear servicio Cloud Run aunque sea free tier.

### 5.2 Crear proyecto y asociar billing
```bash
gcloud projects create sistema-ventas-rifas-prod \
  --name="Sistema Ventas Rifas" \
  --set-as-default

gcloud beta billing projects link sistema-ventas-rifas-prod \
  --billing-account=<BILLING_ACCOUNT_ID>
```

### 5.3 Habilitar APIs
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project=sistema-ventas-rifas-prod
```

### 5.4 Crear repositorio Artifact Registry
```bash
gcloud artifacts repositories create app \
  --repository-format=docker \
  --location=us-east1 \
  --project=sistema-ventas-rifas-prod
```

### 5.5 Crear los 4 secrets
Lee valores del `.env.local` local; nunca aparecen en historial ni logs.

```bash
set -a; source .env.local; set +a

echo -n "$TURSO_AUTH_TOKEN"           | gcloud secrets create turso-auth-token        --data-file=- --replication-policy=automatic --project=sistema-ventas-rifas-prod
echo -n "$MERCADO_PAGO_ACCESS_TOKEN"  | gcloud secrets create mp-access-token         --data-file=- --replication-policy=automatic --project=sistema-ventas-rifas-prod
echo -n "$MERCADO_PAGO_CLIENT_SECRET" | gcloud secrets create mp-client-secret        --data-file=- --replication-policy=automatic --project=sistema-ventas-rifas-prod
echo -n "$MERCADO_PAGO_WEBHOOK_SECRET"| gcloud secrets create mp-webhook-secret       --data-file=- --replication-policy=automatic --project=sistema-ventas-rifas-prod
```

### 5.6 Permisos al service account de Cloud Run
```bash
PROJECT_NUMBER=$(gcloud projects describe sistema-ventas-rifas-prod --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in turso-auth-token mp-access-token mp-client-secret mp-webhook-secret; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=sistema-ventas-rifas-prod
done
```

### 5.7 Cleanup policy en Artifact Registry
```bash
gcloud artifacts repositories create-cleanup-policies app \
  --location=us-east1 \
  --project=sistema-ventas-rifas-prod \
  --policy='[
    {"name": "keep-latest-3", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 3}},
    {"name": "delete-old", "action": {"type": "Delete"}, "condition": {"olderThan": "30d"}}
  ]'
```

---

## 6. Cutover y validación

### 6.1 Secuencia de cutover

Como Vercel ya está caído y la rifa 2025 cerrada, no hay tráfico ni compras pendientes — virgin start.

1. Build local verde (`npm run lint && npm run build` con `output: 'standalone'`; verificar `.next/standalone/server.js`).
2. Setup GCP one-time (sección 5).
3. Primer deploy con placeholder en `NEXT_PUBLIC_BASE_URL` (ej. `https://placeholder.invalid`).
4. Capturar URL real:
   ```bash
   gcloud run services describe sistema-ventas-rifas \
     --region=us-east1 --project=sistema-ventas-rifas-prod \
     --format='value(status.url)'
   ```
5. Actualizar `.env.local` con la URL real en `NEXT_PUBLIC_BASE_URL`.
6. Segundo deploy (segundos) propagando la URL real.
7. Smoke tests (sección 6.2).
8. Update webhook URL en MP dashboard (sección 6.3).
9. Documentación (sección 8).

### 6.2 Smoke tests post-deploy

```bash
URL=$(gcloud run services describe sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod \
  --format='value(status.url)')

# Test 1: servicio responde
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$URL/"
# Esperado: HTTP 200

# Test 2: API toca BD
curl -s "$URL/api/raffle/config" | jq
# Esperado: { "id": "...", "title": "Rifa Escolar 2025", ... }

# Test 3: verificación de número (read-only)
curl -s -X POST "$URL/api/numbers/verify" \
  -H "Content-Type: application/json" \
  -d '{"numbers":[1,2,3]}' | jq
# Esperado: respuesta con availability info

# Test 4: logs limpios
gcloud run services logs read sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod --limit=50
# Esperado: 0 errores
```

Tests 1-4 son bloqueantes. Si alguno falla, NO avanzar al cutover de webhook.

Test 5 (cold start mensurable): opcional, sirve para datar baseline.
```bash
# Esperar 16 min sin tráfico, después medir
time curl -s "$URL/" -o /dev/null
# Esperado: < 5s primera request, < 200ms requests subsiguientes
```

### 6.3 Update del webhook en MercadoPago

Manual desde el dashboard:
1. Login en https://www.mercadopago.com.ar/developers/panel/app
2. Seleccionar la app "Rifas".
3. Notificaciones / Webhooks → editar URL:
   - Antes: `https://sistema-ventas-rifas.vercel.app/api/webhooks/mercadopago`
   - Después: la URL real de Cloud Run + `/api/webhooks/mercadopago` (capturada en paso 6.1.4)
4. Guardar.
5. "Simular notificación" desde MP dashboard → confirmar HTTP 200 desde Cloud Run.
6. Verificar en logs de Cloud Run que la firma HMAC validó: el `MERCADO_PAGO_WEBHOOK_SECRET` debe coincidir entre MP y Secret Manager.

> Si rotás el webhook secret en MP, después actualizar el secret en GCP:
> ```bash
> echo -n "<NUEVO_SECRET>" | gcloud secrets versions add mp-webhook-secret --data-file=- --project=sistema-ventas-rifas-prod
> ./scripts/deploy.sh   # forzar redeploy para que tome la versión nueva
> ```

---

## 7. Disposición post-rifa

Cuando la rifa 2026 cierre:

```bash
gcloud projects delete sistema-ventas-rifas-prod
```

- Libera todo: Cloud Run, Artifact Registry, Secret Manager, billing.
- Reversible los primeros 30 días, después permanente.
- Costo residual: $0 absoluto.

Para rifa 2027 hipotética, el script de setup (sección 5) toma ~10 min. No vale mantener proyecto fantasma 12 meses para ahorrar ese tiempo.

---

## 8. Cambios en docs de gestión

Al cierre del setup, actualizar:

| Archivo | Cambio |
|---|---|
| `CLAUDE.md` | Sección "Hosting" cambia: Vercel → Cloud Run us-east1. Sección Commands: `vercel`/`vercel --prod` → `./scripts/deploy.sh`. Eliminar mención a "Auto-deploy on push to main". Critical Rules: agregar "NUNCA correr `gcloud projects delete sistema-ventas-rifas-prod` durante venta activa". |
| `MEMORIA.md` | Nueva sesión "2026-05-02 — Migración Vercel → Cloud Run". Documentar las 7 decisiones, URL nueva del servicio, ID del proyecto GCP. |
| `ESTADO.md` | Marcar 1.4 cumplida (verificación deploy ahora se hace en Cloud Run). Agregar bitácora de la migración. |
| `BUGS.md` | Nuevo BUG-007 con la causa del pause de Vercel y la solución (migración). |
| `LEARNINGS.md` | Aprendizajes: Hobby tier de Vercel auto-pause por uso comercial, latencia Cloud Run/Turso por región, política de retención Artifact Registry, no-Docker-local con `--source`. |
| `.claude/commands/deploy-vercel.md` | Renombrar a `deploy.md` y reescribir para Cloud Run. |

---

## 9. Riesgos y mitigaciones

| Riesgo | Probabilidad | Severidad | Mitigación |
|---|---|---|---|
| `intellego.ok@gmail.com` sin billing account activo | Media | Bloqueante | Verificar como primer paso del setup (5.1). Si falta, usuario crea uno (5 min, $0 cargo en free tier). |
| Cold start hace timeout en webhook MP | Baja | Baja | MP retry policy: 3 intentos en ~22 min. Cold start ~3-5s. Margen amplio. Webhook handler es idempotente. |
| Cloud Build excede 120 min/día gratis | Baja | Media | Build dura ~3 min → 40 builds/día gratis. Esta sesión hace 5-10 builds totales. |
| Imagen excede 500 MB en Artifact Registry | Baja | Media | Multi-stage + `output: 'standalone'` produce ~150 MB. Cleanup policy mantiene 3 imágenes = ~450 MB. Margen ajustado pero ok. |
| Webhook MP firma falla post-deploy | Media | Alta | Smoke test 6.3 paso 5 lo detecta antes de habilitar la rifa. Si falla: `gcloud run services logs read` para troubleshoot. |
| URL de Cloud Run cambia entre deploys | Baja | Media | Solo cambia si recreás el servicio (raro). Redeploy normal mantiene URL. |
| Free tier cap mensual alcanzado durante venta | Baja | Alta | Tráfico de rifa local es <<< 2M requests/mes. Si por algún motivo se desborda, Cloud Run rechaza requests adicionales (no genera cargo automático sin billing alert). |
| Drift entre `.env.local` local y env vars en Cloud Run | Media | Media | `scripts/deploy.sh` lee `.env.local` en cada deploy → sincronización automática. Pero los secrets están desacoplados (en Secret Manager) — rotación de secret requiere redeploy explícito. |

---

## 10. Fuera de scope

Excluido explícitamente de este spec:

- ❌ Custom domain mapping (postergable a Fase 4.5 si aparece dominio gratuito).
- ❌ CI/CD automatizado (decisión consciente: deploy manual mata sorpresas).
- ❌ Migración de Turso a otra región (no aplica; sigue donde está).
- ❌ Cambio de PSP (sigue MercadoPago Checkout Pro).
- ❌ Multi-region / failover (overkill para rifa local).
- ❌ Tests automatizados E2E (proyecto separado, fuera de migración).
- ❌ Setup de la rifa 2026 (limpieza de BD 2025, nueva config) — es Fase 2 del proyecto, separada de la migración.
- ❌ Cron de cleanup de reservas vía Cloud Scheduler (postergable; el endpoint `/api/cron/cleanup` puede llamarse manualmente o desde GitHub Actions cron mientras tanto).

---

## 11. Criterios de éxito

La migración se considera completa cuando:

1. ✅ `npm run lint && npm run build` pasan localmente con `output: 'standalone'`.
2. ✅ `gcloud run services describe sistema-ventas-rifas` retorna `READY` con la imagen del Artifact Registry.
3. ✅ Smoke tests 1-4 (sección 6.2) pasan con HTTP 200 y respuestas válidas.
4. ✅ Webhook URL en MP dashboard apunta a la URL de Cloud Run y "Simular notificación" devuelve HTTP 200.
5. ✅ Logs de Cloud Run no muestran errores en los 5 min posteriores al smoke test.
6. ✅ Documentación de gestión (CLAUDE.md, MEMORIA.md, ESTADO.md, BUGS.md, LEARNINGS.md) actualizada y commiteada.
7. ✅ Costo acumulado en GCP billing dashboard = $0.

---

## 12. Próximo paso

Pasar a `superpowers:writing-plans` para producir un plan de implementación detallado con orden, dependencias entre pasos, y criterios de validación por paso.
