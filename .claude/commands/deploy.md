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

Si algo falla, **NO continuar**.

### PASO 1: Validación local
```bash
npm run lint
npm run build
test -f .next/standalone/server.js && echo "✅ standalone OK"
```
Si lint o build fallan, **NO continuar**.

### PASO 2: Confirmar con el usuario
Si la rifa está activa (status='active' en tabla `raffles`), preguntá explícitamente:
```
⚠️ La rifa está activa. ¿Confirmás deploy AHORA?
Recordá: "NUNCA pushear cambios al flujo de pago durante horario de venta activa".
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

curl -s -o /dev/null -w "HTTP %{http_code}\n" "$URL/"
curl -s "$URL/api/raffle/config" | python3 -c "import sys, json; print('OK' if 'id' in json.load(sys.stdin) else 'FAIL')"
gcloud run services logs read sistema-ventas-rifas \
  --region=us-east1 --project=sistema-ventas-rifas-prod --limit=30 \
  | grep -iE "error|fatal" || echo "✅ logs limpios"
```

### PASO 5: Reportar
```
✅ Deploy exitoso a Cloud Run.
🌐 URL: <URL>
📊 Smoke tests: HTTP 200, BD conecta, logs limpios.
📝 Recordá `/save` si esto fue parte de una tarea trackeable.
```

## Reglas críticas
1. NUNCA deployar sin haber pasado lint + build localmente.
2. NUNCA deployar durante horario de venta activa sin confirmación explícita.
3. NUNCA modificar flags del script (rompe set de env vars/secrets).
4. Si Cloud Build falla, leer logs con `gcloud builds log <BUILD_ID>` antes de re-intentar.
