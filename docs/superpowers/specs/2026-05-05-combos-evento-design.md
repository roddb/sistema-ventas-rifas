# Spec — Combos del evento (venta online MP)

- **Fecha**: 2026-05-05
- **Autor**: brainstorming session con Romi (project lead) → Claude
- **Origen**: pedido de Romi (WhatsApp) de agregar venta online de combos de comida (sandwich de chorizo / sandwich de carne / 3 empanadas, todos a $15.000 con vaso de gaseosa) integrada al sitio actual de la Rifa STA 2026
- **Status**: aprobado por el usuario tras 5 secciones de diseño
- **Rifa fase asociada**: este spec se ejecuta después del rediseño UI Fase 5.B (que ya está mergeado y deployado a Cloud Run revision `00013-529`). NO bloquea Fase 5.C (admin) ni Fase 5.D restantes.

---

## 1. Contexto y motivación

El sitio actual vende números de rifa ($1.000 c/u, 2.000 disponibles) con flow MP. Romi (que comanda el proyecto y el evento escolar) quiere sumar venta online de combos de comida que se retiran el día del evento. Modelo operativo:

> El usuario compra por la app usando MercadoPago. Cuando se registra en la entrada el día del evento, retira su número de rifa (ya impreso) y/o sus combos contra **nombre + número de reserva**.

3 combos fijos definidos por Romi, todos a $15.000:
- Sandwich de chorizo + vaso de gaseosa
- Sandwich de carne + vaso de gaseosa
- 3 empanadas + vaso de gaseosa

---

## 2. Decisiones locked en el brainstorm

| Decisión | Resolución |
|---|---|
| Tipo de feature | **Venta online vía MP** (replica el modelo de la rifa). Pickup presencial el día del evento contra nombre + código de reserva. |
| Stock | **Ilimitado**. La cocina escolar produce a demanda. Sin tracking de inventory ni reservas con timeout. Sin race conditions sobre stock. |
| Cantidad por compra | **Carrito multi-combo**. El comprador arma el pedido (ej: 2 chorizo + 1 empanada → 1 transacción MP por $45.000, 1 voucher consolidado). |
| Datos del comprador | **Solo contacto**: nombre, email, teléfono. Sin bloque estudiante (combos no son fundraising por curso). |
| UI placement | **Split entry** en la home: dos cards equivalentes (🎟️ Rifa $1.000 / 🍔 Combo $15.000). Click en card abre el flow respectivo. Reemplaza al `HeroLanding.tsx` actual de Fase 5.B. |
| Catálogo de combos | **Hardcoded en código** (`lib/combos.ts`). Sin tabla `combos`, sin admin UI para editar. Cambios de catálogo = redeploy (aceptable para evento de 1 día). |
| Selección de cantidades | **Filas compactas con stepper** +/− inline. Sticky bottom bar con total + CTA "Continuar". Los 3 combos entran sin scroll en mobile. |
| Compra cross-product | **NO**. Rifa y combo son flows MP separados. Si el comprador quiere ambos, hace dos transacciones. Razón: cada flow tiene lógica server distinta (raffle_numbers reservation vs cart line items) y mezclarlos enrarece todo. |

---

## 3. User flow / Information Architecture

```
Landing (/) — view='home'
└─ <ProductSplitHero>: dos cards
   ├─ 🎟 Rifa STA $1.000      onSelect → view='rifa'
   └─ 🍔 Combo evento $15.000 onSelect → view='combo'

Rifa flow (view='rifa') — wizard intacto de Fase 5.B
   └─ NumberGrid → BuyerForm → PurchaseReview → MP → Status

Combo flow (view='combo') — wizard nuevo
   ├─ ComboCatalog       (3 stepper rows + sticky cart total)
   ├─ ComboBuyerForm     (name + email + phone)
   ├─ ComboReview        (resumen pedido + buyer + CTA pagar)
   ├─ MP redirect → Checkout Pro
   └─ ComboSuccess / FailureScreen / PendingScreen
```

**Voucher / pickup en evento**:
- Reservation code: `COM-{nanoid(8)}` (paralelo a `PUR-{nanoid(8)}` del rifa)
- Visible en la SuccessScreen (grande)
- Visible en MP comprobante (se incluye en el title de uno de los items o en `description` de la preference)
- Día del evento: el equipo cruza nombre + COM-code contra el listado admin (Fase 5.C absorbe la pantalla)

**Navegación entre productos**:
- AppHeader variant `wizard` con back arrow durante los flows
- Back arrow → `view='home'` (vuelve al split hero)
- Estado del cart se mantiene en memoria mientras el usuario navega entre catalog/form/review (NO persiste entre sesiones; refresh = cart vacío)

---

## 4. Data model & schema

### 4.1. Catálogo (sin tabla)

`lib/combos.ts`:
```ts
export const COMBOS = [
  { id: 'chorizo',   name: 'Sandwich de chorizo', description: '+ vaso de gaseosa', price: 15000, emoji: '🥪' },
  { id: 'carne',     name: 'Sandwich de carne',   description: '+ vaso de gaseosa', price: 15000, emoji: '🍖' },
  { id: 'empanadas', name: '3 empanadas',         description: '+ vaso de gaseosa', price: 15000, emoji: '🥟' },
] as const;

export type ComboId = typeof COMBOS[number]['id'];
```

Helpers: `getComboById(id)`, `calculateTotal(items)`.

### 4.2. Tablas nuevas

**`combo_purchases`** (paralela a `purchases`, sin campos de rifa):

| col | tipo | notas |
|---|---|---|
| id | TEXT PK | `COM-{nanoid(8)}` |
| buyer_name | TEXT NOT NULL | |
| email | TEXT NOT NULL | |
| phone | TEXT NOT NULL | |
| total_amount | INTEGER NOT NULL | denormalizado |
| items_count | INTEGER NOT NULL | total de combos en el pedido |
| mercado_pago_preference_id | TEXT | |
| mercado_pago_payment_id | TEXT | |
| payment_status | TEXT NOT NULL DEFAULT 'pending' | `pending` / `approved` / `rejected` / `cancelled` |
| payment_method | TEXT | |
| created_at | INTEGER NOT NULL | unix seconds |
| updated_at | INTEGER NOT NULL | unix seconds |

**`combo_purchase_items`** (line items):

| col | tipo | notas |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| combo_purchase_id | TEXT NOT NULL FK → combo_purchases.id | |
| combo_id | TEXT NOT NULL | `chorizo` / `carne` / `empanadas` |
| combo_name_snapshot | TEXT NOT NULL | snapshot del name al momento de compra |
| unit_price | INTEGER NOT NULL | snapshot del precio |
| quantity | INTEGER NOT NULL CHECK(quantity > 0) | |

Snapshots de name+price: si mañana el catálogo cambia (precio sube, agregamos uno nuevo), las compras históricas mantienen el dato exacto que el comprador pagó. Patrón estándar de facturación.

### 4.3. event_logs

Reuse de la columna `purchase_id` (TEXT) genérica para guardar también `COM-xxx`. Sin agregar columna nueva, sin tabla separada. Si Drizzle declara FK estricta a `purchases.id`, se elimina en la migración (SQLite no enforce FKs por default y el campo pasa a ser "owning entity ID" sin enforcement). Prefijos `PUR-` vs `COM-` distinguen la pertenencia.

### 4.4. Por qué NO extender `purchases` polimórficamente

`purchases` tiene `raffle_id`, `student_name`, `division`, `course`, `numbers_count` que no aplican a combos. `purchase_numbers` referencia `raffle_numbers` (no aplica). Volverlos nullable con condicionales por tipo es schema-debt típico que envejece mal. Tablas separadas + dispatch por prefijo del `external_reference` son más limpias y permiten que cada flow evolucione independiente.

### 4.5. Migración

- `lib/db/schema.ts` agrega `comboPurchases` + `comboPurchaseItems`
- (Opcionalmente quita FK estricta de `eventLogs.purchase_id`)
- `npm run db:generate` produce SQL incremental
- **Obligatorio**: agent `db-migration-reviewer` revisa antes de aplicar
- `npm run db:migrate` aplica a Turso productivo
- Cambios non-destructivos (solo CREATE TABLE) — sin downtime, sin riesgo a datos existentes

---

## 5. API routes & integración MercadoPago

### 5.1. Nuevos endpoints

| Endpoint | Método | Propósito |
|---|---|---|
| `/api/combo/purchase` | POST | Crea `combo_purchases` + `combo_purchase_items` en transacción. Valida con Zod. **Calcula total server-side** desde `lib/combos.ts` (NUNCA confía en el price del body). |
| `/api/combo/preference` | POST | Carga el combo_purchase + items, crea preference MP con N items, retorna `{ initPoint, sandboxInitPoint }`. |
| `/api/combo/cancel` | POST | Marca `payment_status='cancelled'` con guard idempotente (`WHERE payment_status='pending'`). |
| `/api/combo/payment/success` | GET | Callback back_url. Redirige a `/?combo=success&order=COM-xxx&payment_id=...`. UI consume y limpia params. |
| `/api/combo/payment/failure` | GET | Idem failure. |
| `/api/combo/payment/pending` | GET | Idem pending. |

Todos con `export const dynamic = 'force-dynamic'` y `revalidate = 0` (regla CLAUDE para endpoints que tocan BD).

### 5.2. Webhook reuse

`/api/webhooks/mercadopago` NO se duplica. Modificación mínima: tras verificar firma HMAC (módulo `lib/webhook-verification.ts` reusado al 100%) y cargar `external_reference`, dispatch por prefijo:

```
external_reference startsWith 'PUR-'  → raffleService.confirmPayment()  (existente)
external_reference startsWith 'COM-'  → comboService.confirmComboPayment() (nuevo)
otro                                  → log UNKNOWN_REFERENCE event + 200 OK
```

La firma HMAC, idempotencia y manejo de 5xx (lección BUG-008) quedan exactamente como están. Cero regresión en seguridad.

### 5.3. Estructura de la MP preference (combo)

```js
{
  external_reference: 'COM-xxx',
  description: 'Pedido COM-xxx · Rifa STA 2026',     // visible en comprobante MP del comprador
  items: [
    { id: 'chorizo',   title: 'Sandwich de chorizo (combo)', quantity: 2, unit_price: 15000, currency_id: 'ARS' },
    { id: 'empanadas', title: '3 empanadas (combo)',         quantity: 1, unit_price: 15000, currency_id: 'ARS' },
  ],
  payer: { name: buyer.name, email: buyer.email },
  back_urls: { success, failure, pending },           // /api/combo/payment/...
  notification_url: '<base>/api/webhooks/mercadopago',
  // sin auto_return (workaround sandbox-MP, lección de Fase 4)
}
```

El `COM-xxx` queda visible para el comprador en 3 lugares: (a) `description` del preference → comprobante MP, (b) SuccessScreen post-redirect, (c) URL params del callback de éxito.

Las URLs derivan de `process.env.NEXT_PUBLIC_BASE_URL` runtime (lección BUG-010 — no usar bloque `env` en `next.config.js`, que inlinea hardcoded en build).

### 5.4. Service layer

`lib/services/comboService.ts` (paralelo a `raffleService.ts`):
- `createComboPurchase({ buyer, items })` — transacción con insert padre + N hijos. Genera `COM-xxx` ID. Computa total server-side.
- `confirmComboPayment({ comboPurchaseId, paymentId, paymentMethod })` — idempotente, optimistic lock `WHERE payment_status='pending'`. Logs `COMBO_PAYMENT_CONFIRMED` event.
- `cancelComboPayment({ comboPurchaseId, reason })` — idempotente, `WHERE payment_status='pending'`. Logs `COMBO_PAYMENT_CANCELLED` event.

**Convención de event_type**: combos usan prefijo `COMBO_` (ej: `COMBO_PURCHASE_CREATED`, `COMBO_PAYMENT_CONFIRMED`, `COMBO_PAYMENT_CANCELLED`, `COMBO_PAYMENT_CONFLICT`). Rifa mantiene los suyos sin prefijo (`PURCHASE_CREATED`, `PAYMENT_CONFIRMED`, etc.). Esto hace las queries de auditoría triviales (`WHERE event_type LIKE 'COMBO_%'` para combos, `WHERE event_type NOT LIKE 'COMBO_%'` para rifa).
- `getComboPurchase(id)` — read con items joineados.

Mismos patrones de transacción + locks + idempotencia que `raffleService` post-BUG-008.

### 5.5. Cron cleanup

Combos no tienen reservas con timeout (stock ilimitado), entonces el cron actual `/api/cron/cleanup` queda intacto y solo opera sobre rifa. Si una combo_purchase queda en `pending` (usuario cerró el browser pre-pago), es inocua: no bloquea recursos, no afecta nada operativo. Cleanup soft de pendings >24h queda fuera de scope para una iteración futura.

---

## 6. Estructura de archivos

```
components/
├── hero/
│   ├── HeroLanding.tsx          ❌ borrar — reemplazado por ProductSplitHero
│   └── ProductSplitHero.tsx     ✚ dos cards (Rifa / Combo) en el home
├── combos/                      ✚ directorio nuevo
│   ├── ComboFlow.tsx            ✚ mini-orchestrator del wizard combos (state local)
│   ├── ComboCatalog.tsx         ✚ pantalla con 3 ComboRow + sticky bottom bar
│   ├── ComboRow.tsx             ✚ fila individual con stepper +/−
│   ├── ComboBuyerForm.tsx       ✚ form name/email/phone (sin bloque estudiante)
│   └── ComboReview.tsx          ✚ resumen pedido + buyer + CTA pagar
├── status/
│   ├── SuccessScreen.tsx        (sin cambios — solo rifa)
│   ├── FailureScreen.tsx        ⚙ prop opcional `productType: 'rifa'|'combo'` para tweaks de copy
│   ├── PendingScreen.tsx        ⚙ ídem
│   └── ComboSuccessScreen.tsx   ✚ muestra COM-xxxx + breakdown del pedido + share WA
├── grid/, form/, review/        (sin cambios)
└── RifasApp.tsx                 ⚙ +30-40 líneas: top-state `view: 'home'|'rifa'|'combo'`

lib/
├── combos.ts                    ✚ const COMBOS + types + helpers
├── services/comboService.ts     ✚ create/confirm/cancel/get
├── db/schema.ts                 ⚙ + comboPurchases + comboPurchaseItems
└── mercadopago.ts               ⚙ + createComboPreference helper

app/api/combo/                   ✚ directorio nuevo
├── purchase/route.ts            ✚
├── preference/route.ts          ✚
├── cancel/route.ts              ✚
└── payment/{success,failure,pending}/route.ts  ✚

app/api/webhooks/mercadopago/route.ts  ⚙ dispatch por prefijo external_reference
```

### 6.1. Decomposición de RifasApp.tsx

```tsx
function RifasApp() {
  const [view, setView] = useState<'home' | 'rifa' | 'combo'>('home');
  if (view === 'home')  return <ProductSplitHero onSelect={setView} />;
  if (view === 'combo') return <ComboFlow onExit={() => setView('home')} />;
  // view === 'rifa' → JSX del wizard rifa intacto, encapsulado en este branch
}
```

`<ComboFlow>` encapsula su propio state machine (catalog → form → review → status) sin tocar el state de rifa. Cero riesgo de regresión cruzada.

### 6.2. Reuse

- `<FormField>` y `<PageContainer>` reusados directos
- `<AppHeader variant="wizard">` con back arrow llamando `onExit` de `<ComboFlow>` → vuelve a home
- `<StickyBottomBar>` reusado dentro de `ComboCatalog` para total + CTA
- `lib/webhook-verification.ts` reusado al 100%

### 6.3. Implicaciones para Fase 5.C (admin pendiente)

- 2 pestañas en admin: Compras de rifa + Compras de combos
- Export CSV: 1 export por tipo
- Búsqueda por nombre/email cubre ambos tipos
- Se planea aquí, se implementa en 5.C

---

## 7. Edge cases & error handling

| Caso | Manejo |
|---|---|
| Cart vacío al submit | CTA disabled cliente + Zod `items.min(1)` server (400) |
| Cantidad absurda | Zod `quantity.max(50)` por item |
| Cliente manda total falso | Server **siempre** recalcula `total = Σ(qty × COMBOS[id].price)` desde el constant |
| Browser refresh mid-cart | Cart se pierde (no localStorage) — aceptable MVP |
| Refresh post-redirect MP | Query params consumidos en mount, fallback Success genérico (patrón I-1 de Fase 5.B) |
| Webhook retries (3× / 22min) | optimistic lock `WHERE payment_status='pending'`. 2da llegada = no-op |
| `external_reference` malformado | Log `UNKNOWN_REFERENCE` + 200 OK |
| MP API 5xx en preference creation | 503 → UI ofrece retry. combo_purchase queda en pending (sin MP id), inocuo |
| Pago `rejected` por MP | Webhook llama `cancelComboPayment(reason='rejected by MP')` → status=cancelled |
| Email comprador con typo | Romi busca por nombre en admin el día del evento |
| Concurrent purchase mismo email | Permitido (familias compran en olas) |

---

## 8. Test strategy

1. **Unit tests** — `tests/combo-service.test.mjs` (patrón `node:test` ya existente):
   - createComboPurchase calcula total correctamente
   - Ignora total del cliente
   - Rechaza comboIds inválidos
   - confirmComboPayment idempotente (2da llegada no duplica logs)
   - cancelComboPayment idempotente

2. **Smoke E2E manual** (dev server + curl + Turso MCP):
   - Happy path: purchase → preference → webhook firmado → confirm → status='approved'
   - **Inspeccionar la preference vía `GET /checkout/preferences/{id}` y verificar `back_urls` + `notification_url` empiezan con https + dominio Cloud Run** (lección BUG-010)
   - Webhook con `external_reference: 'PUR-xxx'` post-cambio → confirmar que rifa NO regresa

3. **Sandbox MP** (CLAUDE rule):
   - TEST credentials, compra ficticia $15.000 multi-item
   - Validar comprobante MP del comprador muestra detalle de los items

4. **Concurrency test** — NO se necesitan tests nuevos. Combos no comparten recurso (stock ilimitado, cero shared resource entre usuarios). El test existente `run-concurrency-test.js` para rifa sigue cubriendo lo único race-sensitive del sistema.

5. **E2E real con plata** — compra real $15.000 de un tercero antes del anuncio final. Replica del cierre de Fase 4.2.

---

## 9. Riesgos & mitigaciones

| Riesgo | Mitigación |
|---|---|
| Modificación al webhook rompe flow rifa | El cambio es 1 dispatch al inicio del handler, resto intacto. + smoke test con `external_reference='PUR-xxx'` post-deploy. + agent `payment-flow-debugger` review antes de mergear. |
| MP rechaza preference multi-item con error inesperado | Sandbox antes de prod. Si pasa, fallback a "1 transacción por tipo" (peor UX, pero recuperable). |
| Migración Turso falla mid-apply | Solo CREATE TABLE — falla atómica, no deja state inconsistente |
| Bug post-deploy afecta rifa en producción | Rollback a revision actual `00013-529` toma ~30 seg. Tablas combo_* quedan vacías/inocuas. |

---

## 10. Plan de rollback

Pre-deploy: capturar nombre de la revision actual del servicio:
```
gcloud run services describe sistema-ventas-rifas --region=us-east1 --project=sistema-ventas-rifas-prod --format='value(status.latestReadyRevisionName)'
```

Si algo se rompe post-deploy:
```
gcloud run services update-traffic sistema-ventas-rifas \
  --region=us-east1 \
  --project=sistema-ventas-rifas-prod \
  --to-revisions=sistema-ventas-rifas-00013-529=100
```

Schema de combos queda en Turso pero sin tráfico → no afecta rifa. Producción restaurada en 30-60 seg.

---

## 11. Out of scope (para iteraciones futuras)

- Catálogo dinámico de combos (admin para editar precios/agregar/sacar) — se difiere
- Tracking de inventario / "agotado" — se difiere (decisión: stock ilimitado para evento 2026)
- Cleanup soft de combo_purchases en `pending` >24h — se difiere
- Email post-compra dedicado al voucher — se difiere (MP comprobante alcanza)
- Purchase cross-product (rifa + combos en 1 sola transacción) — descartado
- Variantes de combos (sabores, picante, sin gaseosa) — fuera de scope para 2026
- Compra cross-event (más de 1 evento simultáneo) — fuera de scope

---

## Cronograma estimado

Implementación dividida en 4 sub-fases (similar al patrón Fase 5):

- **Fase 6.A · Schema + service + APIs** (~2-3h): tablas Drizzle, comboService, 3 routes server, webhook dispatch update
- **Fase 6.B · UI** (~2-3h): ProductSplitHero, ComboFlow, ComboCatalog, ComboRow, ComboBuyerForm, ComboReview, ComboSuccessScreen, modificación RifasApp
- **Fase 6.C · Tests + sandbox MP** (~1-2h): tests unitarios, smoke E2E, sandbox real
- **Fase 6.D · Deploy + smoke prod + compra real** (~1h): merge, deploy Cloud Run, compra real $15.000

Total estimado: 6-9h efectivas. Igual que Fase 5 completa.
