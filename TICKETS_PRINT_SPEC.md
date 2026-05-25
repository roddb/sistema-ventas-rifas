# Sistema de impresión de tickets — Rifa STA 2026

> **Propósito**: Spec self-contained para que Claude Code genere el módulo de impresión de tickets de la Rifa Solidaria STA 2026. El input es la BD productiva (Turso) y el output son hojas A4 imprimibles agrupadas por familia, con líneas de troquelado para separar boletos de rifa y vouchers de combo individuales.
>
> **Autor**: Rodrigo Di Bernardo · co-diseñado con Claude (sesión 2026-05-25)
> **Estado**: spec cerrado para Fase 1 (HTML imprimible). Fase 2 (PDF batch automatizado) queda como follow-up.
> **Ubicación de este doc**: raíz del repo `Sistema de ventas de rifas/`.

---

## 1. Contexto del evento

Evento solidario presencial en el colegio Santo Tomás de Aquino (STA). Las familias compran online (preventa) números de rifa y combos gastronómicos vía la app de este repo. El día del evento llegan a recepción, dan su nombre, y la persona en la mesa les entrega físicamente lo que compraron:

- **Boletos de rifa** — papelitos individuales que la familia conserva por si su número sale en el sorteo del 15 de junio.
- **Vouchers de combo** — papelitos que se canjean en el stand correspondiente del evento (comida, bebida, etc).

**Restricción crítica del dominio**: cada número de rifa y cada unidad de combo deben ser un papel individual. Razones:

1. **Rifa**: si una familia tiene 4 números y los 4 están impresos juntos, al entregar uno para reclamar un premio pierde acceso a los otros 3.
2. **Combos**: si una familia compró 3 unidades del mismo combo, puede querer canjearlos en momentos distintos (uno al llegar, dos más tarde). Si están todos juntos, al canjear el primero se anula la posibilidad de fraccionar.

**Conclusión**: cada hoja A4 contiene N+M tickets independientes troquelados, donde N = cantidad de números de rifa y M = ∑(quantity) por cada combo de la familia. La persona que imprime corta con tijera o guillotina, los engancha juntos por familia (clip o gancho metálico) y los entrega como paquete al pasar por recepción.

---

## 2. Decisiones cerradas (sesión 2026-05-25)

| Decisión | Valor | Razón |
|---|---|---|
| Formato | A4 vertical (210 × 297 mm) | Estándar imprenta argentina |
| QR code | **No** | Recepción tilda contra lista impresa; QR agrega complejidad sin valor claro acá |
| Agrupación por familia | **Una sola hoja con rifa + combos juntos** | Un paquete por familia, simplifica entrega |
| Diferenciación rifa vs combo | Barra lateral izquierda **dorada** para rifa, **azul** para combo | Lectura instantánea al cortar |
| Logo institucional | `public/img/escudo-sta.png` (= escudo UCA, idéntico al de los cuadernillos STA) | Coherencia con material institucional existente |
| Wordmark | `SANTO TOMÁS DE AQUINO` en EB Garamond 700 | Mismo lockup que cuadernillos |
| Orientación del ticket | Horizontal, ancho completo de hoja | 1 corte recto separa todos |
| Línea de corte | Dashed gris suave + label `CORTAR` minúsculo en borde | Guía visible pero no agresiva |
| Sólo se imprime | Orders con `paymentStatus = 'approved'` | Pagos pendientes/rechazados no generan ticket |
| Output Fase 1 | HTML imprimible (Cmd+P → guardar PDF desde browser) | MVP rápido, sin dependencia de Puppeteer |
| Output Fase 2 | PDF batch generado server-side | Follow-up cuando se confirme Fase 1 funcional |

---

## 3. Branding STA (variables a usar)

Extraído de `Diseño_cuadernillos/shared/sta-styles.css`. Estas variables se redeclaran en el CSS del módulo de tickets — no se importa el archivo entero porque queremos que el módulo sea self-contained y no dependa del repo de cuadernillos.

```css
:root {
  /* Colores STA — Azul UCA + Dorado Sol de Aquino */
  --sta-azul:           #1A3264;
  --sta-azul-medio:     #2B4A82;
  --sta-azul-palido:    #EEF2F8;
  --sta-dorado:         #C9A84C;
  --sta-dorado-oscuro:  #A68A3E;
  --sta-dorado-palido:  #FBF5E6;
  --sta-crema:          #FAF7F0;
  --sta-fondo:          #FFFFFF;
  --sta-texto:          #1C1C1C;
  --sta-texto-sec:      #5A5A5A;
  --sta-linea:          #C8C4BC;
  --sta-linea-suave:    #DDD9D2;

  /* Tipografía */
  --sta-fuente-titulo:  'EB Garamond', Georgia, serif;
  --sta-fuente-cuerpo:  'Inter', 'Helvetica Neue', Arial, sans-serif;
}

@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@0,400;0,500;0,600;0,700&display=swap');
```

**Estética general**: clásico-académico, cálido-dorado. Fondo blanco/crema (no gris). Sin gradientes, sin sombras, sin bordes redondeados grandes (radio 2-3px máx).

---

## 4. Layout de la hoja A4

### 4.1 Estructura general

```
┌─────────────────────────────────────────────────────┐  ← top
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓ filete dorado 6mm ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
├─────────────────────────────────────────────────────┤
│  [escudo]  SANTO TOMÁS DE AQUINO                   │
│   50×50    Rifa Solidaria 2026 · Hoja por familia  │  ← header 30mm
├─────────────────────────────────────────────────────┤
│  ┌─ Bloque "Familia" (azul pálido + borde dorado) ─┐│
│  │ Familia: APELLIDO · Alumno: NOMBRE · Curso: 5°A  ││  ← 12mm
│  └────────────────────────────────────────────────┘ │
├ — — — — — — — — — — — — — — — — — — — — — CORTAR — ┤
│ ░░ TICKET RIFA — N° 0247 — Apellido · Alumno · Curso ░░ │ ← 30mm
├ — — — — — — — — — — — — — — — — — — — — — CORTAR — ┤
│ ░░ TICKET RIFA — N° 0851 — Apellido · Alumno · Curso ░░ │
├ — — — — — — — — — — — — — — — — — — — — — CORTAR — ┤
│ ░░ TICKET RIFA — N° 1102 — Apellido · Alumno · Curso ░░ │
├ — — — — — — — — — — — — — — — — — — — — — CORTAR — ┤
│ ▓▓ TICKET COMBO — Pizza Muzza — Apellido — 1 de 1 ▓▓ │
├ — — — — — — — — — — — — — — — — — — — — — CORTAR — ┤
│ ▓▓ TICKET COMBO — Empanadas x6 — Apellido — 1 de 1 ▓▓ │
├ — — — — — — — — — — — — — — — — — — — — — CORTAR — ┤
│ ▓▓ TICKET COMBO — Empanadas x6 — Apellido — 2 de 2 ▓▓ │ ← si quantity=2
└─────────────────────────────────────────────────────┘
  STA · Rifa Solidaria 2026                    pág 1/N
```

### 4.2 Dimensiones (mm)

| Elemento | Medida |
|---|---|
| Hoja | 210 × 297 mm (A4) |
| Margen lateral | 15 mm |
| Margen superior/inferior | 0 / 10 mm (el filete dorado va al borde) |
| Filete dorado superior | 6 mm de alto, full width |
| Header institucional | 30 mm de alto |
| Bloque "Familia" | 12 mm de alto |
| **Ticket individual** | **30 mm de alto** × 180 mm de ancho |
| Footer | 10 mm de alto |
| Capacidad por hoja | header (52 mm) + 7 tickets (210 mm) + footer (10 mm) = 272 mm → entran **7 tickets en la primera hoja**, **8 tickets en hojas siguientes** (sin repetir header completo, sólo "Familia: APELLIDO — cont.") |

### 4.3 Orden de tickets dentro de la hoja

1. Rifas primero, ordenadas por número ascendente (`raffle_numbers.number ASC`).
2. Combos después, agrupados por `comboId`, en el orden en que aparecen en `combo_purchase_items`. Si un combo tiene `quantity > 1`, repetir N tickets idénticos consecutivos numerados "1 de N", "2 de N", etc.

### 4.4 Comportamiento multipágina

Si la familia tiene más de 7 tickets, dividir en hojas:

- Hoja 1: header completo + bloque Familia + 7 tickets.
- Hoja 2+: header reducido (sólo filete dorado + "STA · Rifa 2026 — Familia APELLIDO (cont.)") + 8 tickets.
- Footer en todas: `Familia APELLIDO — pág X/Y`.
- CSS: `page-break-after: always` después de cada familia. Dentro de la familia, los tickets fluyen y el navegador maneja el corte entre hojas automáticamente, pero cada ticket debe tener `page-break-inside: avoid` para no partirse.

---

## 5. Anatomía de cada ticket

### 5.1 Ticket de RIFA

```
┌─ borde sup: dashed #B4B2A9 con label "CORTAR" a la derecha ───┐
│                                                                  │
│  ▌ BOLETO N°       Apellido · Alumno · Curso/División           │
│  ▌                                                               │
│  ▌  0247           Sorteo: 15 de junio de 2026                  │
│  ▌                 Conservar para reclamar premio                │
│  ▌  (38px serif)                                                 │
│  ▲                                                               │
│  └ barra dorada izquierda (4mm)                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Contenido textual exacto** (placeholders en `{llaves}`):

- Eyebrow: `BOLETO N°` (8px, dorado oscuro, letterspacing 1.5px)
- Número grande: `{number con padding a 4 dígitos: 0001-2000}` (38px EB Garamond 700, azul UCA)
- Línea principal: `{buyerName} · {studentName} · {course} {division}` (11px Inter 500)
- Subtexto 1: `Sorteo: 15 de junio de 2026` (10px Inter 400 gris)
- Subtexto 2: `Conservar para reclamar premio` (10px Inter 400 gris)

**Fondo**: `var(--sta-dorado-palido)` `#FBF5E6`
**Barra lateral izquierda**: 4mm de ancho, `var(--sta-dorado)` `#C9A84C`

### 5.2 Ticket de COMBO

```
┌─ borde sup: dashed #B4B2A9 con label "CORTAR" a la derecha ───┐
│                                                                  │
│  ▌ COMBO          Apellido · Canje único — 1 de 1               │
│  ▌                                                               │
│  ▌  Pizza Muzza   Presentar en el stand para retirar            │
│  ▌                Válido sólo el día del evento                  │
│  ▌  (19px serif)                                                 │
│  ▲                                                               │
│  └ barra azul izquierda (4mm)                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Contenido textual exacto**:

- Eyebrow: `COMBO` (8px, azul medio, letterspacing 1.5px)
- Título: `{comboNameSnapshot}` (19px EB Garamond 700, azul UCA)
- Línea principal: `{buyerName} · Canje único — {indice} de {quantity}` (11px Inter 500). Si `quantity = 1` → escribir `Canje único` solo, sin `1 de 1`. Si `quantity > 1` → `Canje único — 1 de 3`, `2 de 3`, etc.
- Subtexto 1: `Presentar en el stand para retirar` (10px Inter 400 gris)
- Subtexto 2: `Válido sólo el día del evento` (10px Inter 400 gris)

**Fondo**: `var(--sta-azul-palido)` `#EEF2F8`
**Barra lateral izquierda**: 4mm de ancho, `var(--sta-azul)` `#1A3264`

### 5.3 Reglas tipográficas

- Sin texto a menos de 9px (legibilidad mínima impresión).
- Sin mayúsculas decorativas (excepto eyebrows con letterspacing y "SANTO TOMÁS DE AQUINO" en el header).
- Sentence case en todo lo demás (alineado con cuadernillos STA).
- Sin negritas dentro del subtexto.

---

## 6. Header institucional y bloque familia

### 6.1 Header (hoja 1)

```html
<div class="hoja-header">
  <div class="filete-dorado"></div>
  <div class="header-content">
    <img src="/img/escudo-sta.png" alt="Escudo STA" class="escudo">
    <div class="wordmark">
      <div class="institucion">SANTO TOMÁS DE AQUINO</div>
      <div class="tagline">Rifa Solidaria 2026 · Hoja de boletos por familia</div>
    </div>
  </div>
</div>
```

- Escudo: 50×50 mm si la hoja tiene espacio, 40×40 si está ajustada. `object-fit: contain` para no deformar.
- Wordmark institución: `EB Garamond 700`, 18-22px, color `var(--sta-azul)`, letterspacing 1.5px.
- Tagline: `EB Garamond 400 italic`, 11px, color `var(--sta-texto-sec)`.

### 6.2 Bloque Familia

```html
<div class="bloque-familia">
  <span><b>Familia:</b> {buyerName}</span>
  <span><b>Alumno/a:</b> {studentName}</span>
  <span><b>Curso:</b> {course} {division}</span>
</div>
```

- Background: `var(--sta-azul-palido)` `#EEF2F8`
- Border-left: 3px solid `var(--sta-dorado)`
- Padding: 8px 12px
- Font-size: 11px Inter 400
- Display: flex, gap: 18px
- Color de los `<b>`: `var(--sta-azul)`

### 6.3 Header reducido (hoja 2+)

```html
<div class="hoja-header-cont">
  <div class="filete-dorado"></div>
  <p>STA · Rifa Solidaria 2026 — Familia {buyerName} (cont.)</p>
</div>
```

Sin escudo. Sólo filete dorado + 1 línea de texto a 12px.

---

## 7. Mapping BD → ticket

### 7.1 Query de una familia (orderId dado)

Dado un `orderId`, los datos para armar la hoja salen de:

```sql
-- Identidad de la familia
SELECT
  id, buyerName, email, studentName, course, division, paymentStatus
FROM orders
WHERE id = ? AND paymentStatus = 'approved';

-- Números de rifa de esa order
SELECT rn.number
FROM purchases p
JOIN purchase_numbers pn ON pn.purchaseId = p.id
JOIN raffle_numbers rn ON rn.id = pn.raffleNumberId
WHERE p.orderId = ? AND p.paymentStatus = 'approved'
ORDER BY rn.number ASC;

-- Combos de esa order (con quantity)
SELECT
  cpi.comboNameSnapshot,
  cpi.quantity,
  cpi.unitPrice
FROM combo_purchases cp
JOIN combo_purchase_items cpi ON cpi.comboPurchaseId = cp.id
WHERE cp.orderId = ? AND cp.paymentStatus = 'approved'
ORDER BY cpi.id ASC;
```

### 7.2 Query del batch (todas las familias)

```sql
SELECT id FROM orders
WHERE paymentStatus = 'approved'
ORDER BY buyerName ASC;
```

Luego iterar y para cada orderId hacer las queries de 7.1. Concatenar las hojas con `page-break-after: always` entre familias.

### 7.3 Casos a contemplar

- **Familia con sólo rifa, sin combos** → hoja muestra solo tickets de rifa, sin sección de combos.
- **Familia con sólo combos, sin rifa** → hoja muestra solo tickets de combo.
- **Combo con quantity = 5** → 5 tickets idénticos numerados "1 de 5" hasta "5 de 5".
- **Familia con 20 números de rifa** → multipágina (3 hojas: 7 + 8 + 5 tickets).
- **`studentName` o `course`/`division` null** → render sin esos campos. La línea principal del ticket queda como `{buyerName}` sólo. El bloque Familia oculta los campos vacíos.

---

## 8. Estructura de archivos a crear

```
Sistema de ventas de rifas/
├── public/
│   └── img/
│       └── escudo-sta.png             ✅ ya copiado
├── app/
│   ├── admin/
│   │   └── tickets/
│   │       └── page.tsx               ← UI mínima: lista + búsqueda + 2 botones
│   └── api/
│       └── admin/
│           └── tickets/
│               ├── [orderId]/
│               │   └── route.ts        ← HTML imprimible de UNA familia
│               └── batch/
│                   └── route.ts        ← HTML imprimible de TODAS (con page-breaks)
├── lib/
│   └── tickets/
│       ├── render.ts                   ← función pura: buildHtml(orders[]) → string
│       ├── styles.ts                   ← CSS embebido como template string
│       └── queries.ts                  ← funciones que leen orders/purchases/combos
└── TICKETS_PRINT_SPEC.md               ✅ este archivo
```

### 8.1 Endpoint `GET /api/admin/tickets/[orderId]`

- **Auth**: header `Authorization: Basic <base64(admin:PASSWORD)>` validado contra `process.env.ADMIN_PASSWORD`. Si falla → 401.
- **Validación**: orderId existe y `paymentStatus = 'approved'`. Si no → 404 con mensaje claro.
- **Cache**: `export const dynamic = 'force-dynamic'; export const revalidate = 0;` (regla del repo).
- **Response**: HTML completo con `<!DOCTYPE html>`, CSS inline en `<style>`, listo para imprimir.
- **Header de respuesta**: `Content-Type: text/html; charset=utf-8`.

### 8.2 Endpoint `GET /api/admin/tickets/batch`

- Mismo auth, mismas reglas.
- Itera orders approved, una página por familia.
- Considera query param opcional `?course=5%C2%B0A` para filtrar por curso (útil si la imprenta procesa por aula).

### 8.3 UI `/admin/tickets`

Página simple, server component salvo donde haga falta interactividad:

- Input de basic auth (si no está autenticado en la sesión, mostrar form simple).
- Tabla con: Apellido | Alumno | Curso | N° rifas | N° combos | Estado | acción "Imprimir".
- Búsqueda por buyerName/email (filtro client-side, dataset chico).
- Botón grande arriba: "Generar PDF batch del evento" → abre `/api/admin/tickets/batch` en nueva ventana, el usuario imprime con Cmd+P.

---

## 9. CSS imprimible — esqueleto

```css
@page {
  size: A4;
  margin: 0;
}

@media print {
  body { background: white; }
  .hoja { box-shadow: none; margin: 0; }
}

body {
  font-family: var(--sta-fuente-cuerpo);
  background: #d8d5cf; /* gris de fondo solo en preview screen */
}

.hoja {
  width: 210mm;
  min-height: 297mm;
  background: var(--sta-fondo);
  margin: 0 auto 10mm;
  position: relative;
  page-break-after: always;
  display: flex;
  flex-direction: column;
}

.hoja:last-child { page-break-after: auto; }

.filete-dorado {
  height: 6mm;
  background: var(--sta-dorado);
  flex-shrink: 0;
}

.header-content {
  padding: 6mm 15mm 4mm;
  display: flex;
  gap: 8mm;
  align-items: center;
}

.escudo { width: 18mm; height: 18mm; object-fit: contain; }

.institucion {
  font-family: var(--sta-fuente-titulo);
  font-size: 22px;
  font-weight: 700;
  color: var(--sta-azul);
  letter-spacing: 1.5px;
  line-height: 1;
}

.tagline {
  font-family: var(--sta-fuente-titulo);
  font-style: italic;
  font-size: 11px;
  color: var(--sta-texto-sec);
  margin-top: 3px;
}

.bloque-familia {
  margin: 0 15mm 6mm;
  padding: 8px 12px;
  background: var(--sta-azul-palido);
  border-left: 3px solid var(--sta-dorado);
  font-size: 11px;
  display: flex;
  gap: 18px;
}

.bloque-familia b { color: var(--sta-azul); font-weight: 600; }

.tickets-container { padding: 0 15mm; flex: 1; }

.ticket {
  page-break-inside: avoid;
  border-top: 1px dashed var(--sta-linea);
  position: relative;
  padding: 10px 12px;
  display: flex;
  gap: 14px;
  align-items: center;
  min-height: 28mm;
}

.ticket::after {
  content: 'CORTAR';
  position: absolute;
  top: -7px;
  right: 0;
  font-size: 8px;
  color: var(--sta-texto-sec);
  background: white;
  padding: 0 4px;
  letter-spacing: 0.5px;
}

.ticket.rifa {
  background: var(--sta-dorado-palido);
  border-left: 4mm solid var(--sta-dorado);
}

.ticket.combo {
  background: var(--sta-azul-palido);
  border-left: 4mm solid var(--sta-azul);
}

.ticket-eyebrow {
  font-family: var(--sta-fuente-titulo);
  font-size: 9px;
  letter-spacing: 1.5px;
  font-weight: 600;
}

.ticket.rifa .ticket-eyebrow { color: var(--sta-dorado-oscuro); }
.ticket.combo .ticket-eyebrow { color: var(--sta-azul-medio); }

.ticket-numero {
  font-family: var(--sta-fuente-titulo);
  font-size: 38px;
  font-weight: 700;
  color: var(--sta-azul);
  line-height: 1;
}

.ticket-combo-nombre {
  font-family: var(--sta-fuente-titulo);
  font-size: 19px;
  font-weight: 700;
  color: var(--sta-azul);
  line-height: 1.1;
}

.ticket-info { flex: 1; font-size: 11px; line-height: 1.5; color: var(--sta-texto); }
.ticket-info b { font-weight: 600; }
.ticket-info .sub { color: var(--sta-texto-sec); font-size: 10px; }

.footer-hoja {
  margin-top: auto;
  padding: 4mm 15mm 6mm;
  border-top: 1px solid var(--sta-linea-suave);
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--sta-texto-sec);
}

.footer-hoja .izq { color: var(--sta-azul); font-weight: 600; }
```

---

## 10. Plan de implementación por fases

### Fase 1 — HTML imprimible (MVP, ~2-3 hs)

1. Crear `lib/tickets/queries.ts` con las 3 funciones de query.
2. Crear `lib/tickets/styles.ts` con el CSS embebido (template string).
3. Crear `lib/tickets/render.ts` con `buildHoja(order, rifas, combos): string` y `buildBatch(orders[]): string`.
4. Crear `app/api/admin/tickets/[orderId]/route.ts` que llama a render y devuelve HTML.
5. Crear `app/api/admin/tickets/batch/route.ts` ídem para batch.
6. Crear `app/admin/tickets/page.tsx` con la UI mínima.
7. Agregar `ADMIN_PASSWORD` a `.env.local` y al README.
8. Probar imprimiendo 1 hoja real (Cmd+P desde browser → Save as PDF).

**Definition of done Fase 1**:
- Una imprenta puede imprimir 1 PDF con todas las familias y entregarlo cortado.
- El troquelado se ve cortable con tijera/guillotina sin errar la línea.
- El escudo carga bien (no roto, no pixeleado en impresión a 300dpi).
- Los page-breaks no parten tickets a la mitad.

### Fase 2 — PDF batch automatizado (follow-up)

Cuando Fase 1 esté validada con impresión real, agregar:

- Endpoint `GET /api/admin/tickets/batch.pdf` que usa Puppeteer/Playwright para renderizar el HTML y devolver un PDF binario.
- Permite descargar directo sin pasar por Cmd+P del browser.
- Considerar caché si la BD ya está congelada (post-cierre de preventa).

### Fase 3 — Logging de entrega (nice-to-have)

Tabla nueva `ticket_deliveries` con `orderId`, `deliveredAt`, `deliveredBy` (nombre de la persona en recepción). Permite cerrar el loop y saber qué familia llegó y qué no.

---

## 11. ANTES DE EMPEZAR — confirmar con Rodrigo

Estas decisiones quedan abiertas. Claude Code debe preguntar al usuario antes de codear:

1. **Fecha del sorteo** — el texto "Sorteo: 15 de junio de 2026" en cada ticket de rifa. ¿Fecha real confirmada? ¿O conviene leerla de `raffles.endDate` para que se actualice si se reprograma? Recomendación: hardcodear acá un placeholder y ofrecerla como prop/env var configurable.

2. **Disclaimer legal en ticket de rifa** — algunas rifas requieren texto tipo "Premios sujetos a las bases del evento. Conservar este boleto para retirar premio." ¿Hay un texto que la dirección del colegio quiera ver impreso? Si sí, agregar como tercer subtexto en el ticket.

3. **Descripción del combo** — `combo_purchase_items` sólo tiene `comboNameSnapshot` (string). Si los nombres son self-explanatory ("Pizza Muzza", "Empanadas x6") está OK. Si hay combos tipo "Combo Familiar A" que necesitan aclarar qué incluyen, hace falta:
   - Agregar columna `descripcion` a `combo_purchase_items` y popularla en checkout, o
   - Mantener un mapa estático `comboId → descripción` en el código.
   Pendiente: revisar los nombres reales en la BD productiva y decidir.

4. **Texto del subtexto en combo** — actualmente sugiere "Presentar en el stand para retirar". ¿Hay un stand único o cada combo tiene un stand distinto? Si distinto, agregar campo `stand` y mostrarlo.

5. **Tickets para combos de quantity > 1** — confirmar el formato `Canje único — 1 de N`. Alternativa: marcar uno solo y poner casilleros para tachar al canjear. Recomendación: la opción actual (papeles independientes) ya está implícita en la decisión inicial.

6. **Auth admin** — actualmente especificado como basic auth contra `ADMIN_PASSWORD` en `.env.local`. ¿Suficiente o conviene algo más robusto (NextAuth, token de sesión)? Para un módulo que sólo usa Rodrigo el día previo al evento, basic auth alcanza.

7. **PDF batch en Fase 1 vs Fase 2** — la propuesta separa fases para reducir riesgo. ¿Querés que Fase 1 incluya también la generación de PDF server-side con Puppeteer? Eso agrega ~1h de implementación + dependencia pesada en Docker.

---

## 12. Notas de implementación (gotchas conocidos del repo)

Estos vienen del CLAUDE.md y aplican acá:

- API routes que tocan BD **deben** exportar `dynamic = 'force-dynamic'` y `revalidate = 0`.
- No usar `localStorage` para nada de estado de tickets — la fuente de verdad es la BD.
- No hardcodear `PRICE_PER_NUMBER` ni `TOTAL_NUMBERS`; si hace falta, leer de `raffles`.
- Cualquier script Node helper que use dotenv debe ser `loadEnv({ path: '.env.local', override: true })`.
- En Drizzle: si se crea una tabla nueva (Fase 3 con `ticket_deliveries`), pasar `createdAt: new Date(), updatedAt: new Date()` explícito en cada insert. Default SQL `CURRENT_TIMESTAMP` queda como string y rompe filtros temporales (lección del BUG-012).
- `next.config.js` NO debe declarar la URL pública en el bloque `env` (lección BUG-010).

---

## 13. Cómo probar

```bash
# Levantar dev server con BD productiva (cuidado, solo lectura acá)
npm run dev

# 1. Probar una familia
open "http://localhost:3000/api/admin/tickets/{orderId-real}" \
  -H "Authorization: Basic $(echo -n 'admin:tu-password' | base64)"

# 2. Probar batch (todas las families approved)
open "http://localhost:3000/api/admin/tickets/batch" \
  -H "Authorization: Basic $(echo -n 'admin:tu-password' | base64)"

# 3. Desde browser:
# - Login en /admin/tickets
# - Click "Imprimir esta familia" en una fila
# - En el preview de Cmd+P verificar:
#   - 1 hoja por familia (excepto si tiene >7 tickets)
#   - Tickets no se parten entre páginas
#   - Líneas de corte alineadas
#   - Escudo carga ok
# - Imprimir UNA hoja física en papel A4 y probar cortar con tijera por las líneas
```

---

## 14. Histórico

- **2026-05-25** — Doc creado. Decisiones cerradas: sin QR, misma hoja por familia, escudo UCA (= escudo STA institucional), wordmark EB Garamond. Open questions listadas en sección 11. Mockup conceptual validado por Rodrigo en chat. Logo copiado a `public/img/escudo-sta.png`.
