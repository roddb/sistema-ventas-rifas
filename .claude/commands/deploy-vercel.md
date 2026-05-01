---
name: deploy-vercel
description: Pipeline de deploy a Vercel con verificaciones previas. Bloquea el deploy si lint, build o env vars fallan.
allowed-tools: Bash, Read
---

# Comando /deploy-vercel

Ejecuta el pipeline de deploy con verificaciones críticas antes de pushear a producción. Sistema de ventas con dinero real → cero tolerancia a deploys con errores.

---

## Pasos

### 1. Verificaciones de seguridad

```bash
# ¿Estamos en main?
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "⚠️ Estás en branch '$BRANCH', no en main. ¿Estás seguro?"
  # esperar confirmación
fi

# ¿Hay cambios sin commitear?
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️ Hay cambios sin commitear. Hacé /save antes."
  git status --short
  # esperar decisión
fi

# Hora actual — si es horario de venta activa, advertir
HOUR=$(date +%H)
if [ "$HOUR" -ge 8 ] && [ "$HOUR" -le 23 ]; then
  echo "⚠️ Horario de venta activa (08-23h ART). Considerá deployar fuera de horario si toca pago/reserva."
fi
```

### 2. Quality gate local

```bash
echo "🔍 Lint..."
npm run lint || { echo "❌ Lint falló. Bloqueado."; exit 1; }

echo "🏗️  Build..."
npm run build || { echo "❌ Build falló. Bloqueado."; exit 1; }

echo "✅ Lint + build OK localmente"
```

### 3. Verificar variables de entorno en Vercel

```bash
echo "📋 Env vars en Vercel:"
vercel env ls 2>/dev/null || echo "(necesitás 'vercel login' primero)"
```

Verificar que existan en **Production** y **Preview**:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `MERCADO_PAGO_ACCESS_TOKEN` (Production: APP_USR-..., Preview: TEST-...)
- `MERCADO_PAGO_PUBLIC_KEY` (idem)
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `NEXT_PUBLIC_BASE_URL`

Si falta alguna:
```
❌ Falta env var: [NOMBRE] en [Production / Preview]
   Cargala con: vercel env add [NOMBRE]
   O en el dashboard: vercel.com → Project → Settings → Environment Variables
```

### 4. Verificar que la rifa está activa en BD

Si tocaste código del flujo de compra, recordá que la BD productiva tiene una rifa activa. Sugerir:
```bash
# Vía MCP turso-cloud si está disponible:
# SELECT id, title, status, totalNumbers FROM raffles WHERE status='active';
```

### 5. Deploy

Preguntar al usuario:
```
¿Deploy a:
1. Preview (vercel)        — para validar antes de prod
2. Production (vercel --prod) — push directo a usuarios reales
```

#### Opción 1: Preview
```bash
vercel
```
Output: URL del preview. Sugerir al usuario:
- Probar `/api/raffle/config` (debe responder 200 con la config)
- Crear una preference con TEST credentials
- Probar el webhook con MP sandbox

#### Opción 2: Production
```bash
# Doble confirmación
echo "⚠️ DEPLOY A PRODUCCIÓN — usuarios reales con dinero real"
echo "Confirmá tipeando 'deploy production'"
# leer respuesta; si no coincide, abortar

vercel --prod
```

### 6. Verificación post-deploy

```bash
DOMAIN="sistema-ventas-rifas.vercel.app"  # ajustar al dominio real

echo "🔍 Smoke tests post-deploy:"

# 1. ¿Responde el endpoint de config?
curl -s "https://$DOMAIN/api/raffle/config" | jq .

# 2. ¿Responde la home?
curl -sI "https://$DOMAIN/" | head -1

# 3. ¿Logs limpios?
echo "Últimas 10 líneas de logs:"
vercel logs --follow=false | head -20
```

### 7. Documentar en ESTADO.md

Sugerir al usuario:
```
✅ Deploy completado.
Actualizá ESTADO.md:
- Marcá [x] en la tarea de deploy
- Agregá entrada en bitácora con fecha + URL del deployment
- Si fue a prod: agregá nota en MEMORIA.md "deploy prod YYYY-MM-DD — [resumen]"
```

---

## Reglas

1. NUNCA deployar a prod con tests de concurrencia fallando — correr `/test-concurrencia` antes
2. NUNCA deployar a prod durante horario de alta venta sin razón crítica
3. NUNCA forzar deploy si lint o build fallan
4. NUNCA cambiar env vars de producción sin haber probado en preview
5. Si la app rechaza el deploy de Vercel → revisar logs con `vercel logs --follow`
6. Tras cualquier deploy a prod: monitorear los próximos 30 min vía `vercel logs --follow`
