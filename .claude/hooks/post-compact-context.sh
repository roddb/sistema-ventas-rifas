#!/usr/bin/env bash
# Hook PostCompact — Re-inyecta contexto crítico tras compactación.
# No bloqueante: siempre exit 0.
#
# Origen: adaptado de Intellego/PAIDEIA post-compact-context.sh.

set -o pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" 2>/dev/null || exit 0

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "unknown")

cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PostCompact","additionalContext":"CONTEXTO POST-COMPACTACIÓN — Sistema de Ventas de Rifas:\n- Branch: $BRANCH\n- Último commit: $LAST_COMMIT\n- Stack: Next.js 14 (App Router) + TypeScript strict + Drizzle + Turso + MercadoPago Checkout Pro\n- Workflow: DIAGNOSE → PLAN → EXECUTE → VALIDATE → DOCUMENT → COMMIT\n- Package manager: npm (NUNCA pnpm/yarn)\n- API routes que tocan BD: SIEMPRE 'export const dynamic = force-dynamic' + 'export const revalidate = 0'\n- Fuente de verdad sobre pago: webhook /api/webhooks/mercadopago (verifica firma HMAC). NUNCA confiar en callback URLs.\n- Anti-sobreventa: UPDATE raffle_numbers SET status=reserved WHERE id IN (...) AND status=available, en transacción, verificar rowsAffected.\n- Estados número: available | reserved | sold. Estados purchase: pending | approved | rejected | cancelled.\n- Configuración rifa (precio/total) viene de tabla raffles, NUNCA hardcodeada.\n- localStorage prohibido para estado de compras → useState + polling 30s.\n- Endpoint /api/test/reset-numbers solo en NODE_ENV !== production.\n- Tras cambios en raffleService o schema raffle_numbers: correr node run-concurrency-test.js.\n- Fuentes de verdad: ESTADO.md (checklist), MEMORIA.md (contexto), BUGS.md, LEARNINGS.md, CLAUDE.md (reglas).\n- Commands: /inicio /save /autoaprendizaje /allow /test-concurrencia /deploy-vercel.\n- Agents: diagnosis-specialist, payment-flow-debugger, concurrency-validator, db-migration-reviewer.\n- Vercel env vars (críticas): TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, MERCADO_PAGO_ACCESS_TOKEN, MERCADO_PAGO_PUBLIC_KEY, MERCADO_PAGO_WEBHOOK_SECRET, NEXT_PUBLIC_BASE_URL — Production con APP_USR-..., Preview con TEST-...\n- Reactivación 2026: BD productiva tiene datos rifa 2025; verificar credenciales MP y Turso antes de cualquier deploy."}}
EOF

exit 0
