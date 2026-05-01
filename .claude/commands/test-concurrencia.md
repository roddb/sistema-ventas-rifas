---
name: test-concurrencia
description: Orquesta el test de concurrencia anti-sobreventa. Valida que múltiples usuarios no puedan comprar el mismo número simultáneamente.
allowed-tools: Bash, Read
---

# Comando /test-concurrencia

Ejecuta la suite de tests de concurrencia con verificaciones previas. Usar después de cualquier cambio en `lib/services/raffleService.ts`, `lib/db/schema.ts` (si toca `raffle_numbers` o `purchase_numbers`), o las API routes de purchase/payment.

---

## Pasos

### 1. Verificar precondiciones

```bash
# El dev server tiene que estar corriendo
curl -s http://localhost:3000/api/raffle/config > /dev/null 2>&1 \
  && echo "✅ Dev server activo" \
  || echo "❌ Dev server NO está corriendo. Abrí otra terminal y corré 'npm run dev'."

# NODE_ENV no debe ser production (el endpoint de reset solo funciona en dev)
[ "$NODE_ENV" = "production" ] && echo "❌ NODE_ENV=production — NUNCA correr en prod" || echo "✅ NODE_ENV ≠ production"

# Existen los scripts
[ -f run-concurrency-test.js ] && echo "✅ run-concurrency-test.js" || echo "❌ FALTA run-concurrency-test.js"
[ -f test-concurrency.js ] && echo "✅ test-concurrency.js" || echo "❌ FALTA test-concurrency.js"
```

Si alguna precondición falla → mostrar al usuario y detener.

### 2. Snapshot del estado de la BD antes del test

```bash
echo "Estado de raffle_numbers antes del test:"
# Idealmente vía MCP turso-cloud — sino, sugerir al usuario abrir Drizzle Studio
echo "Sugerencia: 'npm run db:studio' en otra terminal para inspección visual"
```

### 3. Ejecutar el test principal

```bash
echo "🧪 Ejecutando run-concurrency-test.js..."
node run-concurrency-test.js
```

Capturar el exit code y el output.

### 4. Interpretar resultado

**Resultado exitoso** (output incluye "✅ ¡EXCELENTE!"):
```
✅ Test de concurrencia OK
- Sin sobreventa detectada
- Lógica anti-race intacta
```

**Resultado con problemas** (output incluye "❌ PROBLEMA CRÍTICO"):
```
🚨 SOBREVENTA DETECTADA — bloquear cualquier deploy
- Revisar la transacción en raffleService.reserveNumbers()
- Verificar que el UPDATE incluye 'AND status = available'
- Verificar que rowsAffected se está chequeando
- Considerar rollback de cambios recientes en raffleService

NUNCA pushear a producción con este test fallando.
```

### 5. Reset opcional (después del test)

Preguntar al usuario:
```
¿Resetear los números de prueba (50, 100-105) para dejar la BD limpia?
```

Si dice sí:
```bash
curl -X POST http://localhost:3000/api/test/reset-numbers \
  -H "Content-Type: application/json" \
  -d '{"numbers": [50, 100, 101, 102, 103, 104, 105]}'
```

### 6. Documentar en ESTADO.md

Si el test pasó tras un cambio significativo, sugerir al usuario actualizar ESTADO.md con un check `[x]` en la tarea de validación correspondiente.

---

## Reglas

1. NUNCA correr este test apuntando a producción (verificar `NEXT_PUBLIC_BASE_URL` no sea producción)
2. NUNCA correr el test sin haber hecho `npm install` previamente
3. Si el test falla → detener cualquier flujo de deploy en curso
4. El test de 6 números (`test-concurrency.js`) puede dejar números "sucios" — usar el reset
5. Para mayor confianza, ejecutar 3 veces seguidas — race conditions intermitentes pueden no aparecer en una sola corrida

---

## Output esperado del test exitoso

```
🧪 Iniciando test de concurrencia...

Test 1: Conflicto directo (2 usuarios, número #50)
  ✅ Solo 1 usuario logró la compra
  ✅ El otro recibió error claro

Test 2: Conflictos múltiples (4 usuarios, números 100-105)
  ✅ Cada número se vendió 1 sola vez
  ✅ Total: 6 números a 2-4 usuarios distintos

✅ ¡EXCELENTE! No se detectaron conflictos de sobreventa
   Total de números vendidos: 6
   Usuarios exitosos: 2
```
