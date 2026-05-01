#!/usr/bin/env node
/**
 * Hook UserPromptSubmit — Detección de tipo de tarea + guía de workflow.
 *
 * Lee el prompt del usuario desde stdin JSON, detecta el tipo de tarea
 * (pago / concurrencia / db / deploy / bug / feature / migration) y
 * emite un additionalContext con la guía correspondiente.
 *
 * No bloqueante: siempre exit 0.
 *
 * Origen: adaptado de PAIDEIA/.claude/hooks/problem-type-detector.js,
 * con workflows específicos del dominio rifas (pagos MP, concurrencia,
 * Drizzle, Vercel).
 */

const workflows = {
  pago: {
    keywords: [
      'pago', 'pagar', 'mercadopago', 'mercado pago', 'mp ', 'preference',
      'webhook', 'ipn', 'checkout', 'cobro', 'cobrar', 'access token',
      'mercado_pago', 'mercadopago_', 'sandbox', 'app_usr', 'test-',
    ],
    guidance:
      'PAGO/MP: 1) Probar SIEMPRE primero en sandbox MP (credenciales TEST-...). 2) Verdad sobre el pago = webhook firmado, NO callback URLs. 3) Verificar firma HMAC en /api/webhooks/mercadopago — el manifest debe armarse en orden exacto (id, request-id, ts). 4) Webhook idempotente: chequear purchase.status antes de updatear (MP reenvía notifs). 5) Tras cambios: probar flujo completo end-to-end con 1 número de monto bajo.',
  },
  concurrencia: {
    keywords: [
      'concurren', 'sobreven', 'race', 'race condition', 'simult',
      'reserva', 'reservar', 'al mismo tiempo', 'paralelo', 'concurrent',
      'doble compra', 'doble venta', 'lock',
    ],
    guidance:
      'CONCURRENCIA: 1) Cualquier escritura a raffle_numbers va dentro de db.transaction(). 2) Patrón seguro: UPDATE SET status=X WHERE id IN (...) AND status=Y; verificar rowsAffected === requestedCount; rollback si no. 3) Tras cambios en raffleService o schema raffle_numbers: correr node run-concurrency-test.js con dev server. 4) Tests cubren conflicto directo + conflictos múltiples. 5) NUNCA SELECT-then-UPDATE.',
  },
  db: {
    keywords: [
      'schema', 'drizzle', 'migracion', 'migración', 'migration', 'db:',
      'turso', 'libsql', 'tabla', 'columna', 'foreign key', 'index',
      'd1', 'sqlite', 'transaction', 'transacción',
    ],
    guidance:
      'DB/DRIZZLE: 1) Cambios en lib/db/schema.ts → npm run db:generate → revisar migración generada → npm run db:migrate. 2) NUNCA db push directo a prod sin revisar migración. 3) Lanzar agent db-migration-reviewer si tocás raffle_numbers, purchases o purchase_numbers. 4) Backup de la BD prod antes de aplicar cualquier migración destructiva (DROP COLUMN, RENAME). 5) Verificar con turso-cloud MCP que la prod quedó OK.',
  },
  deploy: {
    keywords: [
      'deploy', 'deployar', 'desplegar', 'vercel', 'production', 'producción',
      'release', 'env var', 'variables de entorno', 'preview', 'staging',
      'vercel env', 'vercel build',
    ],
    guidance:
      'DEPLOY/VERCEL: 1) Verificar npm run lint && npm run build localmente antes de pushear. 2) Variables de entorno deben existir en Vercel (Production + Preview separados — TEST-... en Preview, APP_USR-... en Production). 3) NUNCA pushear cambios al flujo de pago durante horario de venta activa. 4) Tras deploy: probar /api/raffle/config, una preference de prueba y un webhook (con curl o MP sandbox). 5) Si algo falla: vercel logs --follow.',
  },
  bug: {
    keywords: [
      'bug', 'error', 'falla', 'roto', 'no funciona', 'regresion',
      'regresión', 'rompió', 'rompi', 'no anda', 'broken', 'crashea',
      'exception', 'crash',
    ],
    guidance:
      'BUG: 1) Lanzar agent diagnosis-specialist antes de tocar nada. 2) Revisar BUGS.md por bugs históricos similares. 3) Reproducir el bug primero, luego diagnosticar causa raíz, recién entonces fix. 4) Documentar en BUGS.md con BUG-NNN | descripción | causa | solución. 5) Si es regresión: revisar últimos commits con git log para identificar el cambio causante.',
  },
  feature: {
    keywords: [
      'feature', 'agregar', 'nuevo', 'crear', 'implementar', 'sumar',
      'añadir', 'añadar', 'panel admin', 'autenticacion', 'autenticación',
      'auth', 'email', 'notification', 'export',
    ],
    guidance:
      'FEATURE: 1) Verificar que la feature está en ESTADO.md (alguna fase pendiente). Si no, agregarla antes de empezar. 2) Si toca UI: respetar componentes existentes (RifasApp pattern). 3) Si toca BD: pasar por agent db-migration-reviewer. 4) Si toca pago/reserva: pasar por concurrency-validator. 5) Al cerrar: actualizar ESTADO.md + MEMORIA.md (decisión de diseño si la hubo).',
  },
  reactivacion: {
    keywords: [
      'reactivar', 'reactivación', 'levantar', 'retomar', 'arrancar',
      'volver a', 'rifa 2026', 'nueva rifa', 'levantar el proyecto',
    ],
    guidance:
      'REACTIVACIÓN 2026: 1) Verificar npm install + lint + build sin errores tras 8 meses. 2) Revalidar credenciales: MP token (puede haber rotado), Turso auth token, Vercel env vars. 3) BD productiva tiene datos de rifa 2025 — limpiar antes de relanzar (Fase 2.2 en ESTADO.md). 4) Crear nueva fila en raffles + repoblar raffle_numbers. 5) Smoke test E2E con 1 número monto bajo en sandbox antes de producción real.',
  },
};

function detectType(prompt) {
  const lower = prompt.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const [type, config] of Object.entries(workflows)) {
    const score = config.keywords.filter((k) => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = { type, guidance: config.guidance };
    }
  }

  return bestScore > 0 ? best : null;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const prompt = data.user_prompt || data.prompt || '';
    if (!prompt) process.exit(0);

    const detected = detectType(prompt);
    if (detected) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: `[Workflow: ${detected.type.toUpperCase()}] ${detected.guidance}`,
          },
        })
      );
    }
  } catch {
    // Silently ignore
  }
  process.exit(0);
});
