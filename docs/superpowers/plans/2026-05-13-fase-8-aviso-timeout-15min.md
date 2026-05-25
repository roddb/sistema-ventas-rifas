# Fase 8 — Aviso visible del timeout de 15 minutos (mitigación cleanup-vs-webhook race)

**Fecha plan**: 2026-05-13
**Origen**: Caso real familia Pérez Fernández (ORD-fewD3xzB3j, 2026-05-07). Cliente pagó $49.000 con tarjeta de crédito 57 min después de iniciar la compra → cron canceló la reserva a los 15 min → webhook MP llegó después con `ORDER_PAYMENT_AFTER_CANCEL` severity=high. La familia se quedó sin sus 4 números porque el sistema ya los había liberado y 2 los compraron otros. **Resuelto manualmente bloqueando 572 y 1707 en la sesión 2026-05-13** (event_log id=913).
**Objetivo**: que el cliente vea explícitamente el reloj antes y durante el redirect a MercadoPago, para que entienda que un pago lento implica perder la reserva. Mitigación esperada ~70% del Scenario 2 manual.
**Alcance**: SOLO UI. NO toca backend, BD, schema, raffleService ni orderService. Sin cambios en el cron de 15 min (eso podría discutirse aparte, este plan es ortogonal).
**Decisión locked**: opción B del menú del 2026-05-13 — aviso suave en review + pantalla intermedia con countdown antes de redirigir a MP.

---

## Estado actual del flujo (referencia)

`components/order/OrderFlow.tsx:126-133`:
```
const res = await fetch('/api/order/preference', { … });
const json = await res.json();
window.location.href = json.data.initPoint;  // ← redirect inmediato
```

`components/order/UnifiedReview.tsx:89-113`: muestra total + 2 botones (Pagar / Volver). Sin mención del timeout.

`/api/order/purchase` ya devuelve `orderId` al cliente. **No devuelve `createdAt`** — el countdown va a usar `Date.now()` del cliente como anchor (desfase típico <1s, aceptable).

---

## Tareas

### T1 · Aviso en UnifiedReview (15 min)
**Archivo**: `components/order/UnifiedReview.tsx`
**Cambio**: agregar una línea bajo el bloque del total (línea ~92 — entre el div del total y el div de los botones) con copy:

```tsx
<p className="text-xs text-ink-soft text-center px-2">
  ⏱️ Una vez que avances al pago, tenés <strong className="text-ink">15 minutos</strong> para completarlo en MercadoPago. Si tardás más, los números vuelven al pozo y otra persona puede comprarlos.
</p>
```

**Sin cambios de imports ni de lógica**. Solo JSX.

### T2 · Nuevo componente `RedirectingScreen.tsx` (~1.5h)
**Archivo**: `components/order/RedirectingScreen.tsx` (nuevo)
**Props**:
```ts
interface Props {
  initPoint: string;         // URL de MP a la que redirigir
  orderId: string;
  totalAmount: number;
  startedAt: number;         // Date.now() cuando se creó la order
  onCancel: () => void;      // botón "cancelar y volver"
}
```

**Comportamiento**:
- Mostrar `AppHeader` variant=wizard con título "Redirigiendo a MercadoPago".
- Countdown grande centrado: `MM:SS` decreciente desde `15:00`. `useEffect` con `setInterval(1000)` que recalcula `remaining = 15*60 - Math.floor((Date.now() - startedAt) / 1000)`. Cleanup con `clearInterval`.
- Cuando `remaining <= 0`: cambiar texto a "Tu reserva expiró. Si pagaste igual, el equipo se contactará con vos." + cambiar botón a "Volver al inicio".
- Mensaje principal: "Pagá tu compra en los próximos **15 minutos** o tus números volverán al pozo. Te abrimos MercadoPago automáticamente en unos segundos."
- Mostrar resumen mini: `Orden ORD-xxx · Total $X.XXX`.
- Botón primario "Continuar a MercadoPago" (`<a href={initPoint}>` con styling de botón brand).
- Botón secundario "Cancelar compra" → llama a `onCancel` (que internamente debería hacer DELETE `/api/order/cancel` con el orderId; el padre maneja esto). Solo visible mientras `remaining > 0`.
- Auto-redirect a `initPoint` tras 4s usando `setTimeout` + `window.location.href`. Cancelable si el usuario clickea el botón antes.
- Animación sutil: el ⏰ del countdown cambia a color `state-sold` (rojo del design system) cuando `remaining <= 300` (último 5 min).

**Componentes a reusar del design system**: `PageContainer`, `AppHeader`, tokens `bg-brand`, `text-ink`, `text-ink-soft`, `bg-surface-raised`, `text-accent`, `text-state-sold`.

**Sin librerías nuevas**. lucide-react ya disponible (usar `Clock` icon).

### T3 · Cablear RedirectingScreen en OrderFlow (~45 min)
**Archivo**: `components/order/OrderFlow.tsx`
**Cambios**:
1. Agregar nuevo step al union de `step`: `'review' | 'redirecting' | …` (revisar el tipo exacto al ejecutar).
2. En `handleConfirm` (función que actualmente llama `/api/order/preference` y hace `window.location.href = initPoint`):
   - **Antes** de redirigir: guardar `{ initPoint, startedAt: Date.now() }` en state y setear `step = 'redirecting'`.
   - **Quitar** el `window.location.href` inmediato.
3. Renderizar `<RedirectingScreen ... />` cuando `step === 'redirecting'`.
4. Cuando se cancela desde RedirectingScreen → ejecutar `cancelOrder()` existente + volver a `step='review'` (o `'cart'`, evaluar UX al ejecutar).

**Nota crítica**: el `startedAt` debería idealmente ser el momento de creación de la order (cuando se hizo el `/api/order/purchase`, no el momento del click "Pagar"). Si OrderFlow ya guarda ese timestamp en state, reusarlo. Si no, capturarlo al recibir la respuesta de `/api/order/purchase` y mantenerlo en state durante el flujo.

### T4 · Verificación local (~30 min)
- `npm run lint` debe pasar.
- `npm run build` debe compilar.
- Test manual local con `npm run dev`:
  1. Carrito con 1 número + 1 combo → review → ver el aviso del timeout.
  2. Click "Pagar" → ver RedirectingScreen con countdown arrancando en `15:00` o cercano.
  3. Esperar 4s → verificar auto-redirect a MP (puede ser sandbox o solo confirmar que `window.location` cambia).
  4. Test del estado "expirado": modificar `startedAt` a `Date.now() - 16*60*1000` y verificar mensaje "reserva expiró".
- **NO correr concurrency tests** — este cambio no toca backend ni race conditions.

### T5 · Deploy (~30 min)
- Ventana de deploy: **horario de baja conectividad** (acuerdo con el usuario). Sugerido: domingo madrugada o lunes 6-7am ART.
- Backup BD productiva pre-deploy via Turso MCP a `backups/rifa-2026-pre-fase8-YYYY-MM-DD.json` (gitignored).
- `./scripts/deploy.sh` → nueva revision Cloud Run.
- Smoke prod post-deploy:
  - Home 200.
  - Flujo completo de 1 número hasta ver `RedirectingScreen` con el countdown.
  - Cancelar desde RedirectingScreen → confirmar que el order pasa a `cancelled` y los números vuelven a `available`.
- Rollback target si falla: revision actual al momento del deploy (capturar con `gcloud run services describe sistema-ventas-rifas --region=us-east1 --format='value(status.latestReadyRevisionName)'` antes de deployar).

### T6 · Cierre (~15 min)
- Actualizar `ESTADO.md`: marcar Fase 8 como `[x]`.
- Actualizar `MEMORIA.md`: agregar entrada de bitácora con el caso Pérez Fernández + decisión de UX + revision Cloud Run.
- Commit con `/save`.

---

## Archivos tocados (totales)

| Tipo | Path |
|---|---|
| MOD | `components/order/UnifiedReview.tsx` (~5 líneas) |
| NEW | `components/order/RedirectingScreen.tsx` (~120 líneas) |
| MOD | `components/order/OrderFlow.tsx` (~25 líneas) |
| MOD | `ESTADO.md` (cierre) |
| MOD | `MEMORIA.md` (cierre) |

Total estimado: **3-4h efectivas** incluyendo deploy.

---

## Gates del workflow FEATURE

- [x] Feature agregada a ESTADO.md (Fase 8 — se agrega en este plan).
- [x] Toca UI: respeta `OrderFlow` pattern y design tokens existentes (brand, ink, surface-raised, accent, state-sold).
- [n/a] NO toca BD → no requiere `db-migration-reviewer`.
- [n/a] NO toca pago/reserva → no requiere `concurrency-validator` (es solo display de información derivada del client clock).
- [ ] Al cerrar: actualizar ESTADO.md + MEMORIA.md (T6).

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Usuario clickea "Volver" del browser durante RedirectingScreen y queda en estado inconsistente | T3 sub-tarea 4: `onCancel` llama explícitamente al endpoint `/api/order/cancel` antes de cambiar step. Adicionalmente, si vuelve sin cancelar, el cron lo limpia a los 15min como hoy. |
| `Date.now()` del cliente está desfasado >1 min vs server | Mostrar el countdown como aproximado, no critical path. El cron sigue siendo source of truth. Aceptable. |
| El user cierra la pestaña antes del auto-redirect → no llega a MP | Mismo comportamiento que hoy si se cierra la pestaña post-redirect. Cron lo limpia. No empeora. |
| `setInterval` deja leak si el componente unmonta antes | Cleanup explícito en `useEffect` return. Standard React pattern. |
| Auto-redirect 4s es muy corto y user no alcanza a leer | Configurable. Si se reporta, subir a 6s. |
| Auto-redirect 4s es molesto en mobile (user quiere leer y elegir) | Hay botón "Continuar a MP" visible inmediatamente. Cancelable por click. |

---

## Decisiones de diseño locked

- **Anchor del countdown**: client clock `Date.now()` en el momento de creación de la order (no del click "Pagar", para que el countdown ya empiece a correr antes del review). Si OrderFlow no guarda ese timestamp todavía, capturarlo al recibir `/api/order/purchase` response.
- **Color de alerta**: `state-sold` (rojo del design system) cuando quedan ≤5 min, neutral antes.
- **Auto-redirect delay**: 4 segundos. Suficiente para leer el mensaje sin ser abrumador.
- **Cancel button**: visible solo mientras `remaining > 0`. Si expiró, no tiene sentido cancelar (cron ya liberó o lo va a liberar pronto).
- **Sin polling al backend desde RedirectingScreen**: redundante y carga server. El cron sigue siendo authoritative.
- **Sin sticky countdown global** (opción C descartada por agobiar al usuario calmo).

---

## NO hacer en esta fase (out of scope)

- Subir el timeout del cron de 15 a 30 min (decisión aparte, requiere considerar concurrency).
- Alertas email/Slack al admin cuando llega `ORDER_PAYMENT_AFTER_CANCEL` (mejora separada).
- Backend countdown precision (createdAt en el payload de `/api/order/purchase` response) — futuro si el client clock causa problemas.
- Cambios al schema. Cambios a webhooks. Cambios al cron.

---

## Ventana de ejecución sugerida

Deploy en domingo madrugada o lunes 6-7am ART. Antes del deploy hay ~3h de trabajo de implementación que pueden hacerse en cualquier momento (cambios locales sin impacto en producción hasta que se ejecute `./scripts/deploy.sh`).
