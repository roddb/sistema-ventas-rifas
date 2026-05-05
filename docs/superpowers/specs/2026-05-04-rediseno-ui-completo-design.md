# Rediseño UI Completo — Sistema de Ventas de Rifas STA 2026

**Fecha**: 2026-05-04
**Autor**: Brainstorming colaborativo (Rodrigo + Claude)
**Estado**: Diseño aprobado, listo para implementation plan

---

## 1. Contexto

La app de ventas de rifas escolares pasó por la rifa 2025 (1.500 números, 134 compras) con un diseño utilitario "hecho a las apuradas". Para la edición 2026 (2.000 números a $2.000 c/u) se decide rediseñar la UI completa antes del lanzamiento. La motivación principal es modernizar la imagen institucional del colegio STA: la rifa va a circular por WhatsApp del colegio y la primera impresión define si el padre confía y compra o se va.

**Estado de la app antes del rediseño**:
- Una sola pantalla monolítica (`components/RifasApp.tsx`, 1.587 líneas) que contiene todo: hero, grilla de 2.000 números, formulario, review, success/failure, panel admin oculto.
- Tailwind 3.4.7 + lucide-react. Sin sistema de design tokens propio.
- Estilo actual: gradientes simples, scrollbar custom, animaciones básicas. Sin identidad de colegio.
- Backend (Drizzle + Turso + MercadoPago) ya está sólido y NO se toca en este rediseño.

**Lo que NO entra en este spec**:
- Cambios al schema de la BD.
- Cambios al flujo de pago (MercadoPago Checkout Pro vía `/api/preference` + webhook IPN).
- Cambios a la lógica anti-sobreventa (transacciones Drizzle con guards).
- Tests de concurrencia.

---

## 2. Prioridades del rediseño

Recogidas en brainstorming con el usuario, en orden:

1. **Modernizar la imagen institucional**. La rifa STA tiene que sentirse como un evento serio del colegio, no como una página utilitaria.
2. **Aumentar conversión**. Reducir la fricción entre "veo el link" y "pagué".
3. **Reducir fricción para audiencia mayor**. Padres de 50+ tienen que poder usarla solos, en mobile, sin pedir ayuda.
4. **Plus si es memorable**. Que cuando se comparta por WhatsApp, otros padres digan "qué bien hecho".

**No se busca**: estética childlike, neón saturado, ilustraciones cartoon, brutalist, glitch, ni cualquier estilo "trendy" que choque con audiencia mayor o con la solemnidad del colegio.

---

## 3. Decisiones de diseño cerradas

### 3.1 Dirección visual

**Moderno confiado**. Sans geométrica fuerte (Inter), bloques de color sólidos, jerarquía tipográfica firme, border-radius medio (6-12px), espaciado generoso pero compacto. Vibra Stripe / Linear / producto B2B contemporáneo. Limpio, directo, sin ornamentación.

Descartadas:
- *Editorial minimalista* (austera, riesgo audiencia mayor).
- *Cálido institucional* (cremas y dorados, demasiado "club centenario").
- *Bento moderno* (juguetón, demasiado "app" para audiencia mayor).

### 3.2 Paleta

| Token | Hex | Uso |
|-------|-----|-----|
| `primary` | `#1E3A8A` | Azul royal — header, CTAs primarios, números de identidad |
| `primary-tint` | `#F0F4FF` | Fondo de chips, badges, contenedores informativos |
| `surface` | `#FAFBFD` | Fondo general de la app |
| `surface-elevated` | `#FFFFFF` | Cards, inputs, sticky bars |
| `border` | `#E5E7EB` | Bordes finos, separadores |
| `text-primary` | `#0F1C3D` | Headings, números grandes |
| `text-secondary` | `#475569` | Body |
| `text-muted` | `#6B7280` | Captions, labels secundarios |
| `accent` | `#F59E0B` | Ámbar — número seleccionado, acentos de atención |
| `accent-strong` | `#D97706` | Hover/active de ámbar |
| `state-available-bg` | `#DCFCE7` | Celda grilla disponible — fondo |
| `state-available-fg` | `#15803D` | Celda grilla disponible — texto |
| `state-reserved-bg` | `#E5E7EB` | Celda grilla reservada — fondo |
| `state-reserved-fg` | `#6B7280` | Celda grilla reservada — texto |
| `state-sold` | `#DC2626` | Celda grilla vendida (texto blanco sobre rojo) |
| `state-warning-bg` | `#FEF3C7` | Banner timeout 15 min |
| `state-warning-border` | `#FCD34D` | Borde banner timeout |
| `state-warning-fg` | `#78350F` | Texto banner timeout |
| `mp-blue` | `#009EE3` | Color oficial de MercadoPago — solo en CTA "Pagar con MP" |

**Pendiente**: el usuario va a confirmar los hex institucionales reales de STA. Si difieren, se ajustan `primary` / `primary-tint` / `text-primary` para alinearse al manual de marca.

### 3.3 Tipografía

- **Familia única**: Inter (Google Fonts), pesos 400/500/600/700/800/900.
- **Letterspacing**: `-0.02em` para headings (h1, números grandes), `-0.01em` para subheadings, default para body, `0.04-0.08em` para labels uppercase.
- **Tamaños mobile** (target principal):
  - h1 / hero title: 28-32px / weight 800 / line-height 1.1
  - h2: 20-22px / weight 700 / line-height 1.15
  - body: 14-15px / weight 400 / line-height 1.5
  - label small uppercase: 11-12px / weight 600 / letter-spacing 0.05em
  - números grandes (success, hero): 48-72px / weight 900 / letter-spacing -0.04em
- **Desktop**: escala 1.05-1.1× sobre mobile. No hay layouts a doble columna.

### 3.4 Spacing & elevation

- Sistema base 4 (4 / 8 / 12 / 16 / 20 / 24 / 32 / 48).
- Border-radius: 4 (chips chicos) / 6 (botones, inputs) / 8 (banners) / 10-14 (cards).
- Sombras suaves: `0 1px 3px rgba(0,0,0,0.04)` para cards, sin sombras agresivas.
- Sin gradientes salvo el opcional fade del hero (transparente → primary-tint).

### 3.5 Modelo de selección de número

**Paginado por centenas con tabs/segmentos**.

- 20 grupos: 1-100, 101-200, …, 1.901-2.000.
- Tabs scrolleables horizontalmente arriba de la grilla.
- Solo se muestra un grupo de 100 a la vez.
- Search bar arriba que acepta un número (ej: "1234") y salta automáticamente al rango correspondiente, posicionando ese número en el viewport.
- Grid de 8 columnas en mobile, 10 en tablet, 12 en desktop.
- Celdas con número visible, no solo color.
- Sticky bar abajo con resumen ("1 número · $2.000") + chip del número seleccionado + CTA "Continuar".

Descartado: grilla scroll completa de 2.000 (abrumador), search-first + "Sorprendéme" (no se eligió).

### 3.6 Multi-número

**1 número por compra**. La UI restringe a una selección activa. Si el usuario clickea un segundo número disponible, se reemplaza el primero sin toast (más fluido — el usuario probablemente cambió de idea).

Razón: simplicidad de UX y conversión rápida. El backend igualmente ya soporta multi-número (`purchase_numbers` es M:N), pero la UI no lo expone.

### 3.7 Datos del estudiante

Se mantienen los 3 campos actuales:
- `studentName` (texto)
- `course` (año, dropdown 1° a 7°)
- `division` (texto corto, A/B/C/D)

Justificación: el colegio quiere saber el curso/división del estudiante para que el premio "vuelva al curso correcto". Bloque visual diferenciado en el form (fondo `primary-tint`).

### 3.8 Flujo (4 pasos)

```
1. Hero / Landing      (ruta: /)
2. Elegí tu número     (ruta: /, step=2)
3. Tus datos           (ruta: /, step=3)
4. Revisá tu compra    (ruta: /, step=4) → redirect a MercadoPago
   ↓
   ↓ MercadoPago Checkout Pro (externo)
   ↓
5. Success / Failure / Pending (rutas: /api/payment/{success,failure,pending} → redirect a / con flag)
```

**Decisión arquitectónica**: se mantiene el patrón actual de wizard en una sola ruta (`/`) con estado `currentStep`. NO se separa en rutas dedicadas. Razón: la grilla se beneficia de tener el estado en memoria (selección, polling de números), y separar en rutas obligaría a re-fetchear todo en cada paso.

**Nota de implementación**: cuando MP redirige al usuario de vuelta (`/api/payment/success`), el handler debe redirigir a `/?status=success&purchaseId=...` para que el frontend muestre la pantalla 5 con el número grande.

### 3.9 Mobile-first y responsive

- **Mobile** (default, audiencia mayoritaria por WhatsApp): single column, max-width 100vw, padding 16px, sticky headers y CTAs.
- **Tablet** (640-1024px): max-width 600px centrado.
- **Desktop** (>1024px): max-width 560px centrado. NO se usan layouts de 2 columnas. La app se siente "una columna premium" en cualquier device.

### 3.10 Trust signals

En el hero:
- Pill superior "RIFA ANUAL · EDICIÓN 2026" en `primary-tint`.
- Card de información con precio y disponibles ("1.872 / 2.000").
- Microcopy "Pagás 100% online con MercadoPago".

En la grilla:
- Leyenda de colores siempre visible.
- Counter "X seleccionado".

En review:
- Banner ámbar de timeout 15 min (`state-warning-*`).
- Microcopy "🔒 Pago seguro · MercadoPago".

En success:
- Check verde grande.
- Comprobante con número en formato "0005" (4 dígitos, padding cero) para que se vea como "premio formal".
- CTA secundario "Compartir por WhatsApp" (genera deeplink `whatsapp://send?text=...`).

---

## 4. Pantallas y comportamiento

### 4.1 Hero / Landing

**Composición** (mobile, top-down):
1. Header sticky azul royal con badge "STA" (logo cuando lo pase el usuario) + texto "Colegio STA" + meta "2026".
2. Pill informativo "RIFA ANUAL · EDICIÓN 2026".
3. H1 grande "La Gran Rifa STA 2026" en `text-primary`.
4. Body de 2-3 líneas con copy institucional sobre la tradición de la rifa anual (sin mencionar destino del recaudado — decisión del usuario).
5. Card de info con 2 columnas: precio | disponibles.
6. CTA primario "Elegir mi número →" full-width.
7. Microcopy "Pagás 100% online con MercadoPago".

**Behavior**:
- El contador "disponibles" se hidrata desde `/api/raffle/config` y `/api/numbers` en mount. Polling cada 30s.
- Click en CTA → `setCurrentStep(2)`.

### 4.2 Elegí tu número

**Composición**:
1. Header sticky con back button + título "Elegí tu número" + counter "X sel."
2. Search bar (input con icono lupa).
3. Tabs horizontales scrolleables con los 20 rangos. Tab activo en `primary` con texto blanco.
4. Leyenda de colores (disponible / tuyo / vendido).
5. Grid de números (8 cols mobile, 10 tablet, 12 desktop) — solo el rango activo.
6. Sticky bar abajo con resumen + chip del número seleccionado + CTA Continuar.

**Behavior**:
- Mount → fetch `/api/numbers` (devuelve los 2.000 estados).
- Tap en tab → cambia el `activeRange` (state local, no fetch nuevo).
- Search:
  - Submit con número válido (1-2000) → cambia tab al rango correspondiente y hace scroll del número al viewport.
  - Submit con número vendido/reservado → toast informativo.
  - Submit con número inválido → error inline.
- Tap en celda disponible → la marca como seleccionada (ámbar). Si ya había una seleccionada, se deselecciona la anterior.
- Tap en celda no-disponible → ignora el click.
- Polling cada 30s para refrescar estados (anti-sobreventa visual).
- CTA Continuar deshabilitado si no hay selección.

### 4.3 Tus datos

**Composición**:
1. Header sticky con back + título "Tus datos" + meta "2 / 4".
2. H2 "¿A nombre de quién va el número?"
3. Body de copy explicativo ("Si ganás te contactamos por estos datos").
4. Inputs:
   - Nombre comprador (label + input)
   - Email (label + input)
   - Teléfono (label + input)
5. Bloque diferenciado con fondo `primary-tint`:
   - Header "Estudiante del colegio"
   - Microcopy
   - 3 inputs en línea: nombre estudiante (flex-1) + año (50px) + división (42px)
6. Sticky bar abajo con CTA "Revisar compra →".

**Behavior**:
- Validación con Zod en submit (mismo schema que `/api/purchase`).
- Errores de validación se muestran inline debajo del campo.
- Submit válido → POST `/api/purchase` (crea purchase pending + reserva número) → si OK, `setCurrentStep(4)`.
- Si `/api/purchase` devuelve error de "número ya no disponible" (race condition) → toast + back a step 2 con `loadNumbers()` para refrescar.

### 4.4 Revisá tu compra

**Composición**:
1. Header sticky con back + título "Revisá tu compra" + meta "3 / 4".
2. H2 "Última revisión".
3. Card grande con número seleccionado (chip ámbar, número grande).
4. Card de tabla con datos: comprador / email / estudiante / total.
5. Banner ámbar de timeout 15 min.
6. Sticky bar abajo:
   - CTA primario "Pagar con MercadoPago →" (color `mp-blue` para señal visual).
   - Microcopy "🔒 Pago seguro · MercadoPago".

**Behavior**:
- Click en back → vuelve a step 3 manteniendo datos del form.
- Click en CTA Pagar → POST `/api/preference` con el `purchaseId` → recibe `init_point` → `window.location.href = init_point`.
- Si la creación de preference falla → toast de error + ofrece "Reintentar" o "Cancelar compra" (esta segunda opción libera el número).

### 4.5 Success

**Composición** (todo centrado vertical):
1. Header simple (sin back).
2. Check verde grande (60×60, fondo `state-available-bg`, ícono verde).
3. H1 "¡Tu número es tuyo!"
4. Body con confirmación de email.
5. Card destacada con border ámbar grueso:
   - Label "Tu número"
   - Número en formato 4 dígitos, 48-72px, weight 900, color `primary`.
   - Caption "Sorteo: a definir" (placeholder hasta que se decida fecha).
6. CTA secundario "📲 Compartir por WhatsApp".
7. Link tertiary "¿Querés otro número? Volver al inicio →".

**Behavior**:
- Llega como redirect de `/api/payment/success?purchaseId=...`. El handler valida el purchase, redirige a `/?status=success&purchaseId=...`.
- En mount con `status=success`, fetch `/api/purchase/{id}` para obtener el número confirmado.
- Botón WhatsApp genera URL: `https://wa.me/?text=${encodeURIComponent('¡Tengo el número 0005 en La Gran Rifa STA 2026! 🎟')}`.

### 4.6 Failure

**Composición**:
1. Header simple.
2. Ícono de alerta rojo (`#DC2626`, fondo `#FEE2E2`).
3. H1 "Hubo un problema con el pago".
4. Body explicativo: "MercadoPago no pudo procesar tu pago. Tu número {N} sigue disponible si querés intentar de nuevo en los próximos 15 minutos."
5. CTA primario "Reintentar pago →" (re-genera preference con la misma purchase).
6. CTA secundario "Volver al inicio".

**Behavior**:
- Si dentro de los 15 min: ofrece reintentar (POST `/api/preference` con misma purchase).
- Si pasaron los 15 min: la purchase está cancelada y el número liberado por el cron; el botón "Reintentar" hace un new flow desde step 1.

### 4.7 Pending

**Composición**:
1. Header simple.
2. Ícono reloj ámbar (`accent`).
3. H1 "Tu pago está en proceso".
4. Body: "MercadoPago aún está confirmando tu pago. En cuanto se confirme te llega el comprobante por email. Podés cerrar esta pantalla."
5. Card con número (en estado "pending", visual menos celebratorio que success).
6. CTA secundario "Volver al inicio".

**Behavior**:
- Polling cada 10s a `/api/purchase/{id}` durante 2 minutos. Si pasa a `approved` → redirige a success. Si pasa a `rejected` → redirige a failure. Si después de 2 min sigue pending → mantiene la pantalla y deja que el webhook eventualmente actualice (el usuario verá el cambio en su email).

### 4.8 Panel admin (Fase 3.1 incluida)

**Acceso**:
- Ruta `/admin` con autenticación básica HTTP (env var `ADMIN_USERNAME` + `ADMIN_PASSWORD` en Cloud Run, secrets en Secret Manager).
- Middleware de Next.js intercepta `/admin/*` y valida credenciales.
- Sin auth → 401 con WWW-Authenticate header (browser muestra prompt nativo).

**Composición**:
1. Header simple azul royal con título "Admin · Rifa STA 2026" + botón "Salir" (clear basic auth + redirect a /).
2. Stats cards (3 columnas en desktop, 2 en mobile):
   - Total vendido (número grande)
   - % vendido vs disponible
   - Recaudación bruta ($X.XXX.XXX)
3. Tabs horizontales: "Compras" / "Estados grilla" / "Logs".
4. Tab Compras:
   - Tabla de compras `approved` con columnas: fecha / número / comprador / email / estudiante / curso / monto / estado.
   - Filtro por estado (approved / pending / rejected / cancelled).
   - Paginación 50 por página.
   - Botón "Exportar CSV" (Fase 3.3 traída a este scope porque ya tenemos la query).
5. Tab Estados grilla:
   - Lista compacta de los 2.000 números agrupados por rango con count de cada estado.
   - Botón "Liberar reservas vencidas" (manualmente dispara el cron cleanup).
6. Tab Logs:
   - Tabla de `event_logs` últimas 100 entradas: timestamp / tipo / payload (truncated).

**Behavior**:
- Todas las queries server-side, fetch desde el admin component vía rutas dedicadas en `/api/admin/*` (también protegidas con basic auth, mismo middleware).
- Sin escritura desde el admin salvo el botón "Liberar reservas vencidas" (que solo dispara el cron existente).

**Pendiente operativo (no es código)**:
- Setear `ADMIN_USERNAME` y `ADMIN_PASSWORD` en Secret Manager + bind a Cloud Run.

---

## 5. Estructura de componentes

Romper el monolito de `RifasApp.tsx` (1.587 líneas) en componentes pequeños. Estructura propuesta:

```
components/
├── RifasApp.tsx                  # Container principal (~150 líneas: routing entre steps + estado global)
├── layout/
│   ├── AppHeader.tsx             # Header sticky azul royal
│   ├── StickyBottomBar.tsx       # CTA bar sticky (usado en grid, form, review)
│   └── PageContainer.tsx         # Wrapper con max-width responsive
├── hero/
│   └── HeroLanding.tsx           # Pantalla 1
├── grid/
│   ├── NumberGrid.tsx            # Pantalla 2 — coordina search + tabs + cells
│   ├── NumberSearch.tsx          # Search bar
│   ├── RangeTabs.tsx             # Tabs scrolleables 20 rangos
│   ├── NumberCell.tsx            # Celda individual (memo)
│   └── GridLegend.tsx            # Leyenda de colores
├── form/
│   ├── BuyerForm.tsx             # Pantalla 3 — orquestación
│   ├── FormField.tsx             # Input + label + error
│   └── StudentBlock.tsx          # Bloque diferenciado del estudiante
├── review/
│   └── PurchaseReview.tsx        # Pantalla 4
├── status/
│   ├── SuccessScreen.tsx         # Pantalla 5
│   ├── FailureScreen.tsx
│   └── PendingScreen.tsx
└── admin/
    ├── AdminApp.tsx              # /admin container
    ├── StatsCards.tsx
    ├── PurchasesTable.tsx
    ├── GridStates.tsx
    └── LogsTable.tsx
```

**Convención**:
- Cada componente exporta un único default export.
- Props tipadas con interfaces (no inline).
- Estado local con `useState`/`useReducer`. Estado global mínimo, vive en `RifasApp.tsx` y baja por props.
- Sin libs de state management nuevas (no Redux, no Zustand).
- `lucide-react` se mantiene para iconos.
- Tailwind + design tokens en `tailwind.config.ts` con los hex listados en §3.2.

---

## 6. Sistema de design tokens

Crear `tailwind.config.ts` extendido con los tokens de §3.2, §3.3, §3.4. Migrar los hex hardcodeados del `RifasApp.tsx` actual a clases Tailwind con tokens.

Pendiente confirmar con el usuario si va a pasar los hex STA reales antes de empezar la implementación o se arranca con los hex provisorios y se ajustan después con un find/replace de tokens.

---

## 7. Items pendientes (no bloquean el spec)

1. **Logo STA**. El usuario lo pasa después. Reemplaza el círculo blanco con "STA" en el header. Formato esperado: SVG (preferido) o PNG con transparencia.
2. **Hex STA reales**. Si el azul royal `#1E3A8A` y el ámbar `#F59E0B` no son los institucionales, se ajustan los tokens `primary` y `accent` en `tailwind.config.ts` y los gradientes derivados. Cambio mecánico, sin impacto en arquitectura.
3. **Fecha de sorteo**. El placeholder "Sorteo: a definir" en success queda hasta que el colegio decida fecha. Se setea con un campo en la tabla `raffles` (ya existe `endDate`).
4. **Credenciales admin**. `ADMIN_USERNAME` + `ADMIN_PASSWORD` en Secret Manager + bind a Cloud Run. No es código del rediseño, es operación.

---

## 8. Riesgos y consideraciones

### 8.1 Concurrencia (riesgo crítico)

El rediseño NO toca la lógica anti-sobreventa. Pero hay un punto donde la UI nueva interactúa con la lógica:
- El polling de 30s en grid + el step 3→4 que crea la purchase: si el usuario tarda más de 30s en el form y otro usuario compró el mismo número entre medio, la creación de purchase va a fallar con error claro. La UI nueva lo tiene contemplado (4.3 Behavior — toast + back a step 2 con loadNumbers).
- Sigue rigiendo: cualquier cambio futuro a `raffleService` o schema `raffle_numbers` exige `node run-concurrency-test.js`.

### 8.2 Cache y dinamismo

Las API routes ya tienen `dynamic = 'force-dynamic'` y `revalidate = 0` (lección BUG-H001). El rediseño no introduce SSG ni ISR; todo sigue server-rendered on demand.

### 8.3 Impacto en bundle size

Un solo componente de 1.587 líneas vs ~15 componentes de 50-200 cada uno: el bundle final puede crecer ~10-15 kB por ceremonia de imports/exports. Aceptable. Tree-shaking de lucide-react sigue funcionando si se importan iconos individualmente.

### 8.4 Logo y assets

El logo STA va a quedar en `public/logo-sta.svg`. Si el usuario lo pasa como PNG, se queda como tal pero se prefiere SVG para que escale bien en headers de distintos tamaños.

### 8.5 Mobile testing

El rediseño se valida en mobile real (no solo Chrome devtools). Antes de marcar el rediseño como completo, hacer smoke test en:
- iPhone Safari (audiencia ~50% de los padres)
- Android Chrome (audiencia ~45%)
- Desktop Chrome (audiencia ~5%, mayormente padres tech-savvy)

---

## 9. Migración del componente actual

`RifasApp.tsx` actual (1.587 líneas) se reemplaza completamente. Estrategia:

1. Crear todos los nuevos componentes de §5 en paralelo (no sustituyen al actual).
2. Crear nuevo `RifasApp.tsx` slim que orquesta los nuevos.
3. Reemplazar el import en `app/page.tsx`.
4. Borrar el código viejo de `RifasApp.tsx`.

No hay coexistencia: es un swap completo. Razón: la lógica está acoplada al render del monolito; intentar refactor incremental es más caro que reescritura limpia.

`useLocalStorage` (líneas 45-70 del actual) se descarta — la fuente de verdad es la BD, lección BUG-H001.

`VENTAS_CERRADAS` constante hardcoded (línea 7) se reemplaza por `raffleConfig.isActive` derivado del API. Esto cierra la deuda técnica anotada en BUG-009. Bandera `is_active=false` en BD apaga las ventas sin redeploy.

---

## 10. Definición de "done"

El rediseño se considera completo cuando:

1. Las 7 pantallas (hero, grid, form, review, success, failure, pending) están implementadas con los componentes de §5.
2. El admin panel `/admin` funciona con basic auth y muestra los 3 tabs de §4.8.
3. `npm run lint` y `npm run build` pasan en verde.
4. Smoke tests manuales en iPhone Safari, Android Chrome y desktop Chrome confirman que el flujo completo funciona.
5. Test de concurrencia (`node run-concurrency-test.js`) pasa (no debería verse afectado por ser solo cambios UI, pero se corre como gate).
6. Deploy a Cloud Run revision nueva, validado con compra real de 1 número (Fase 4.2 cumplida con el rediseño).
7. ESTADO.md, MEMORIA.md, BUGS.md, LEARNINGS.md actualizados con la decisión de diseño y los aprendizajes.

---

## 11. Out of scope explícito

- Multi-número por compra (decisión del usuario: 1A).
- Dark mode (no pedido, no priorizado).
- i18n (la app es solo en español).
- PWA / instalable (no pedido, baja conversión esperada).
- Notificaciones push.
- Email post-compra automatizado más allá del comprobante de MP (decisión 2026-05-04: descartado).
- Tests unitarios de componentes (se mantiene la cobertura actual: solo concurrencia + webhook).
- Animaciones complejas (Framer Motion, GSAP). Se usan transiciones CSS simples si hace falta.

---

## 12. Cronograma estimado (plan grueso, lo afina writing-plans)

**Fase A** — Fundamentos (sistema de design + components shell):
- Tailwind config con tokens
- Componentes layout (AppHeader, StickyBottomBar, PageContainer)
- ~1-2 sesiones

**Fase B** — Pantallas públicas (5 screens del flujo de compra):
- Hero + Grid + Form + Review + Success/Failure/Pending
- ~3-4 sesiones

**Fase C** — Panel admin con basic auth:
- Middleware + 3 tabs + export CSV
- ~1-2 sesiones

**Fase D** — Validación + deploy:
- Smoke en mobile real
- Concurrency test
- Deploy + compra real
- ~1 sesión

Total estimado: 6-9 sesiones.

---

## 13. Próximo paso

Pasar al implementation plan vía `superpowers:writing-plans` skill, dividiendo este spec en tareas ejecutables con TDD donde aplique (lógica de search, generación de tabs, validación de form), y con review checkpoints donde corresponde.
