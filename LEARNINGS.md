# Aprendizajes del proyecto

> Generado y mantenido por `/autoaprendizaje`.
> Registro histórico de mejoras identificadas y aplicadas.
> Reglas de negocio operativas se promueven a `CLAUDE.md` (sección "Reglas aprendidas"). Aprendizajes técnicos contextuales viven aquí.

## Registro de aprendizajes

### 2025-09-11 — Sesión inaugural (debugging + integración MP)

- **2025-09-11** Convención usuario — Editar `raffle_numbers` directamente en Turso Studio sin crear los registros relacionados en `purchases` y `purchase_numbers` produce inconsistencias visibles desde el frontend. Cualquier intervención manual a la BD debe pasar por una transacción que toque las 3 tablas o por `raffleService`. _(Destino: CLAUDE.md)_ _(Origen: BUG-H002)_

- **2025-09-11** Error evitable — Las API routes de Next.js 14 cachean por defecto, incluso las que tocan BD. Para endpoints dinámicos, agregar siempre `export const dynamic = 'force-dynamic'` y `export const revalidate = 0`. _(Destino: CLAUDE.md)_ _(Origen: BUG-H001 — números no se actualizaban tras compra por caché de Next)_

- **2025-09-11** Error evitable — `localStorage` para estado de compras genera UI obsoleta entre sesiones. Usar `useState` + fetch en mount + polling 30s. _(Destino: CLAUDE.md)_ _(Origen: BUG-H001)_

- **2025-09-11** Convención técnica — `PRICE_PER_NUMBER` y `TOTAL_NUMBERS` se leen de la tabla `raffles` vía `/api/raffle/config`, nunca hardcodeados en componentes. _(Destino: CLAUDE.md)_ _(Origen: BUG-H001 — valor 500 hardcodeado contradecía $2.000 de la BD)_

- **2025-09-11** Herramienta — Las variables de entorno en Vercel no se sincronizan automáticamente desde `.env.local`. Hay que cargarlas explícitamente en Project Settings → Environment Variables, separadas por entorno (Production / Preview / Development). Usar `vercel env pull` para traer las de Vercel a local. _(Destino: CLAUDE.md)_ _(Origen: BUG-H004)_

- **2025-09-11** Técnico — En el flujo MercadoPago, las callback URLs (`/api/payment/success|failure|pending`) son **solo para experiencia de usuario**. La fuente de verdad sobre el estado real del pago es el webhook `/api/webhooks/mercadopago`, que recibe la notificación firmada de MP. NUNCA actualizar `purchases.status` ni `raffle_numbers.status` desde un callback URL. _(Destino: solo registro)_ _(Origen: integración MP, sesión 2025-09-11)_

- **2025-09-11** Técnico — El webhook MP puede recibir la misma notificación múltiples veces (retries de MP). El handler debe ser idempotente: verificar `purchases.status` antes de updatear, no asumir que la primera llegada es la única. _(Destino: solo registro)_ _(Origen: integración MP)_

- **2025-09-11** Técnico — La verificación de firma HMAC del webhook MP requiere construir el `manifest` exactamente como MP lo describe en la doc (con `id`, `request-id`, `ts` en orden específico). Cualquier desorden falla la verificación silenciosamente. _(Destino: solo registro)_ _(Origen: integración MP, primer intento de webhook rechazaba todas las notifs por firma)_

### 2025-09-14 — Sesión 2 (test de concurrencia)

- **2025-09-14** Técnico — Las pruebas de concurrencia deben correrse contra el dev server activo (no contra producción) y usar delays aleatorios 0-200ms para simular condiciones reales. Sin delays, todos los requests llegan al server en lockstep y el comportamiento no refleja la realidad. _(Destino: solo registro)_ _(Origen: TEST_CONCURRENCIA.md, diseño inicial del test)_

- **2025-09-14** Técnico — Para anti-sobreventa, la única estrategia confiable es `UPDATE raffle_numbers SET status='reserved' WHERE id IN (...) AND status='available'` dentro de una transacción, y verificar `result.rowsAffected === requestedCount`. Si no, rollback. SELECT-then-UPDATE es vulnerable a race conditions. _(Destino: CLAUDE.md)_ _(Origen: diseño de `raffleService.reserveNumbers`)_

- **2025-09-14** Convención usuario — El endpoint `/api/test/reset-numbers` solo debe responder en `NODE_ENV !== 'production'`. Habilitarlo en prod sería catastrófico (cualquiera podría liberar números vendidos). _(Destino: CLAUDE.md)_ _(Origen: TEST_CONCURRENCIA.md)_

### 2025-09-26 — Sesión 3 (reset de números y limpieza)

- **2025-09-26** Técnico — `nanoid` produce IDs de 21 caracteres por default; para `purchase.id` queda más legible y único de sobra. No bajar el tamaño para "ahorrar" — la colisión es teórica pero el debugging post-mortem se complica si dos compras quedan con IDs muy parecidos. _(Destino: solo registro)_ _(Origen: discusión durante la implementación)_

### 2026-05-01 — Sesión de reactivación + modernización

- **2026-05-01** Convención técnica — La gestión de proyecto madura en este repo sigue el patrón gold standard de Intellego Platform / Diseño_cuadernillos / Auditoría PAIDEIA: 5 .md raíz (CLAUDE, ESTADO, MEMORIA, BUGS, LEARNINGS) + `.claude/{settings.json, hooks/, commands/, agents/}`. Los archivos antiguos quedan en `old_docs/` como referencia histórica, no se editan. _(Destino: CLAUDE.md)_ _(Origen: modernización 2026-05)_

- **2026-05-01** Herramienta — El hook `pre-commit-gate.sh` adaptado a este repo bloquea (a) `\n` literal en .md (regresión BUG-005 de PAIDEIA), (b) conflict markers de git sin resolver, (c) archivos >5MB sin confirmación. Los meta-docs (CLAUDE, ESTADO, MEMORIA, BUGS, LEARNINGS, README) están exentos del check (a) porque legítimamente documentan el caracter `\n`. _(Destino: solo registro)_ _(Origen: adaptación de PAIDEIA pre-commit-gate)_

- **2026-05-01** Herramienta — El hook `stop-quality-gate.sh` adaptado a Next.js corre `npm run lint` y `npm run build` antes de cerrar sesión. Falla bloqueante si alguno falla. Para iterar rápido sin trigger del gate, usar mensajes que no impliquen Stop (ej. continuar el thread). _(Destino: solo registro)_ _(Origen: adaptación de Intellego stop-quality-gate)_

- **2026-05-01** Herramienta — El hook `problem-type-detector.js` adaptado clasifica el prompt del usuario en 5 workflows: `pago` (MP, webhook, preference), `concurrencia` (anti-sobreventa, race), `db` (Drizzle, schema, migración), `deploy` (Vercel, env vars), `bug` (incidentes, regresión). Cada workflow inyecta una guía corta en `additionalContext`. _(Destino: solo registro)_ _(Origen: adaptación del problem-type-detector de PAIDEIA)_

---

## Notas

- Los aprendizajes pre-2026-05 fueron reconstruidos a partir de `old_docs/Historial.md` y `old_docs/TEST_CONCURRENCIA.md`. Para detalle textual exacto de la sesión inaugural, consultar esos archivos.
- A partir de 2026-05-01, los aprendizajes son capturados por `/autoaprendizaje` con timestamp y origen explícito.
- Convención de niveles (heredada de PAIDEIA):
  - **Nivel 1 (LEARNINGS.md solo)**: aprendizaje informativo o contextual
  - **Nivel 2 (CLAUDE.md sección "Reglas aprendidas")**: regla operativa que debe seguirse siempre
  - **Nivel 3 (modificación de un command)**: el flujo de trabajo del command cambia
