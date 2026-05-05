# Rediseño UI — Fase 5.B — Pantallas Públicas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el monolito `components/RifasApp.tsx` (1.587 líneas) por una arquitectura de componentes modular que implementa las 5 pantallas del flujo de compra (Hero, Grid paginada, Form, Review, Success/Failure/Pending) usando los tokens de design + layout components creados en Fase 5.A. Sin tocar APIs ni `lib/services/raffleService.ts`.

**Architecture:** RifasApp slim como container de estado y routing entre 7 steps; cada step es su propio componente. Los 3 atomos visuales del grid (NumberCell, NumberSearch, RangeTabs, GridLegend) son reutilizables y memoizados. State global vive en RifasApp y baja por props (sin Context, sin Zustand). API integration idéntica a la actual: `/api/raffle/config`, `/api/numbers`, `/api/purchase`, `/api/preference`. Las pantallas Success/Failure/Pending se montan vía query params que las routes `/api/payment/{success,failure,pending}` ya inyectan al redirigir al frontend.

**Tech Stack:** Next.js 14.2.5 App Router · TypeScript strict · Tailwind 3.4.7 · React 18.3.1 · Inter via next/font/google · lucide-react · Zod (validación de form en server, no se replica en cliente).

**Spec de referencia:** `docs/superpowers/specs/2026-05-04-rediseno-ui-completo-design.md` (secciones 4 pantallas y comportamiento, 5 estructura de componentes, 9 migración).

**Plan anterior:** `docs/superpowers/plans/2026-05-05-rediseno-ui-fase-5a-fundamentos.md` (Fase 5.A — design tokens + 3 layout components).

**Validación:** No hay tests unitarios para componentes UI (decisión spec §11). Validación por task: `npm run lint` + `npm run build` verde. Validación final: smoke en mobile real (iPhone Safari, Android Chrome) + `node run-concurrency-test.js` con dev server + curl al deploy productivo.

---

## Scope check

Este plan cubre **solo Fase 5.B** del spec (5 pantallas públicas + payment routes wiring). Las fases siguientes son planes separados:
- **5.C** Panel admin con basic auth (3 tabs + export CSV) — plan futuro.
- **5.D** Validación cross-device + concurrency + deploy + compra real — plan futuro (bridge entre 5.B y 5.C).
- **5.E** Logo SVG y hex institucionales reales — ajuste de tokens, no requiere plan formal (1 commit corto cuando el usuario los pase).

Pendientes operativos del usuario que NO bloquean este plan:
- Logo SVG de STA (el `AppHeader` placeholder con texto "STA" sigue funcionando hasta que llegue).
- Hex institucionales (azul royal `#1E3A8A` + ámbar `#F59E0B` provisorios).

---

## File structure

```
components/
├── RifasApp.tsx                       # REWRITE — slim container (~250 líneas, era 1.587)
├── layout/                            # Existe desde Fase 5.A
│   ├── PageContainer.tsx
│   ├── AppHeader.tsx
│   └── StickyBottomBar.tsx
├── hero/
│   └── HeroLanding.tsx                # CREATE — pantalla 1
├── grid/
│   ├── NumberGrid.tsx                 # CREATE — pantalla 2 orquestador
│   ├── NumberCell.tsx                 # CREATE — celda individual (memo)
│   ├── NumberSearch.tsx               # CREATE — search bar con submit
│   ├── RangeTabs.tsx                  # CREATE — tabs scrolleables 20 rangos
│   └── GridLegend.tsx                 # CREATE — leyenda colores
├── form/
│   ├── BuyerForm.tsx                  # CREATE — pantalla 3 orquestador
│   ├── FormField.tsx                  # CREATE — input + label + error inline
│   └── StudentBlock.tsx               # CREATE — bloque estudiante diferenciado
├── review/
│   └── PurchaseReview.tsx             # CREATE — pantalla 4
└── status/
    ├── SuccessScreen.tsx              # CREATE — pantalla 5 success
    ├── FailureScreen.tsx              # CREATE — pantalla 5 failure
    └── PendingScreen.tsx              # CREATE — pantalla 5 pending
app/api/payment/
├── success/route.ts                    # MODIFY — fallback URL al Cloud Run real (no Vercel)
├── failure/route.ts                    # MODIFY — fallback URL al Cloud Run real
└── pending/route.ts                    # MODIFY — fallback URL al Cloud Run real
tailwind.config.js                       # MODIFY — remover spin-slow + gradient-radial sin uso
components/layout/StickyBottomBar.tsx    # MODIFY — flatten template literal multi-línea
components/layout/PageContainer.tsx      # MODIFY — min-h-screen → min-h-dvh
```

**No se toca**: `app/api/numbers/*`, `app/api/purchase/*`, `app/api/preference`, `app/api/webhooks/mercadopago`, `app/api/raffle/config`, `app/api/cron/cleanup`, `app/layout.tsx`, `app/globals.css`, `lib/*`, `next.config.js`, `Dockerfile`. Las APIs y la lógica de negocio quedan idénticas.

---

## Worktree setup (recommended)

Antes de empezar, considerar levantar un worktree aislado:

```bash
cd "/Users/rodrigodibernardo33gmail.com/Documents/App Development Proyects/Sistema de ventas de rifas"
git worktree add ../sistema-ventas-rifas-fase-5b -b rediseno-ui/fase-5b
cd ../sistema-ventas-rifas-fase-5b
npm install
```

Razones para worktree en 5.B (no eran necesarias en 5.A):
- Reemplazo wholesale de un componente productivo de 1.587 líneas.
- Riesgo de regresión visual durante la transición.
- Permite probar la app nueva en `localhost:3000` mientras producción Cloud Run sigue sirviendo la legacy sin afectarse.
- Si se aborta el rediseño, `git worktree remove` limpia sin tocar main.

Si el usuario prefiere trabajar en main directamente, saltear esta sección — los cambios siguen siendo locales hasta el push.

---

## Task 1: Slim RifasApp shell (estado global + step routing)

**Files:**
- Modify: `components/RifasApp.tsx` — rewrite completo (1.587 líneas → ~250)

**Decisión arquitectónica clave**: este task crea el shell completo con state, effects, API wrappers, y step routing — pero los 7 screens se renderean como placeholders `<div>Hero placeholder</div>`, etc. Tasks 2-9 reemplazan cada placeholder por su componente real. Esto permite validar el shell antes de invertir en pantallas individuales.

- [ ] **Step 1: Reescribir `components/RifasApp.tsx` con el shell**

Replace the entire content of `components/RifasApp.tsx` with:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import PageContainer from './layout/PageContainer';

// === Types ===

export interface RaffleConfig {
  id: number;
  title: string;
  totalNumbers: number;
  pricePerNumber: number;
  isActive: boolean;
}

export interface RaffleNumber {
  id: number;
  number: number;
  status: 'available' | 'reserved' | 'sold';
}

export interface FormData {
  buyerName: string;
  email: string;
  phone: string;
  studentName: string;
  course: string;
  division: string;
}

export type Step = 'hero' | 'grid' | 'form' | 'review' | 'success' | 'failure' | 'pending';

const EMPTY_FORM: FormData = {
  buyerName: '',
  email: '',
  phone: '',
  studentName: '',
  course: '',
  division: '',
};

const POLLING_INTERVAL_MS = 30000;

export default function RifasApp() {
  // === State ===
  const [raffleConfig, setRaffleConfig] = useState<RaffleConfig | null>(null);
  const [numbers, setNumbers] = useState<RaffleNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('hero');
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // === API wrappers ===
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/raffle/config', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Config ${res.status}`);
      setRaffleConfig(await res.json());
    } catch (e) {
      console.error('loadConfig:', e);
      setError('No pudimos cargar la información de la rifa.');
    }
  }, []);

  const loadNumbers = useCallback(async () => {
    try {
      const res = await fetch(`/api/numbers?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error(`Numbers ${res.status}`);
      const data = (await res.json()) as RaffleNumber[];
      setNumbers(data);
    } catch (e) {
      console.error('loadNumbers:', e);
      setError('No pudimos cargar los números. Reintentá en unos segundos.');
    }
  }, []);

  const createPurchase = useCallback(async (data: FormData, number: number, totalAmount: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: data.buyerName,
          studentName: data.studentName,
          division: data.division,
          course: data.course,
          email: data.email,
          phone: data.phone,
          numbers: [number],
          totalAmount,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || 'No se pudo reservar el número');
      }
      setPurchaseId(body.purchaseId as string);
      setCurrentStep('review');
    } catch (e) {
      console.error('createPurchase:', e);
      setError(e instanceof Error ? e.message : 'Error al crear la compra');
      await loadNumbers();
      setCurrentStep('grid');
    } finally {
      setIsLoading(false);
    }
  }, [loadNumbers]);

  const startPayment = useCallback(async () => {
    if (!purchaseId || !selectedNumber || !raffleConfig) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId,
          buyerName: formData.buyerName,
          email: formData.email,
          numbers: [selectedNumber],
          totalAmount: raffleConfig.pricePerNumber,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success || !body.initPoint) {
        throw new Error(body.error || 'No se pudo iniciar el pago');
      }
      window.location.href = body.initPoint as string;
    } catch (e) {
      console.error('startPayment:', e);
      setError(e instanceof Error ? e.message : 'Error al iniciar el pago');
      setIsLoading(false);
    }
  }, [purchaseId, selectedNumber, raffleConfig, formData]);

  // === Effects ===

  // Initial load + polling
  useEffect(() => {
    loadConfig();
    loadNumbers();
    const id = setInterval(loadNumbers, POLLING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadConfig, loadNumbers]);

  // Detect status redirect from MP callback (?payment=success|failure|pending)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const purchase = params.get('purchase');
    const pid = params.get('payment_id');
    if (payment === 'success' && purchase) {
      setPurchaseId(purchase);
      if (pid) setPaymentId(pid);
      setCurrentStep('success');
    } else if (payment === 'failure' && purchase) {
      setPurchaseId(purchase);
      setCurrentStep('failure');
    } else if (payment === 'pending' && purchase) {
      setPurchaseId(purchase);
      if (pid) setPaymentId(pid);
      setCurrentStep('pending');
    }
  }, []);

  // === Step actions ===

  const goToGrid = useCallback(() => {
    setError(null);
    setCurrentStep('grid');
  }, []);

  const goToForm = useCallback(() => {
    if (!selectedNumber) return;
    setError(null);
    setCurrentStep('form');
  }, [selectedNumber]);

  const goToReview = useCallback(async () => {
    if (!selectedNumber || !raffleConfig) return;
    await createPurchase(formData, selectedNumber, raffleConfig.pricePerNumber);
  }, [selectedNumber, raffleConfig, formData, createPurchase]);

  const goBack = useCallback(() => {
    setError(null);
    if (currentStep === 'grid') setCurrentStep('hero');
    else if (currentStep === 'form') setCurrentStep('grid');
    else if (currentStep === 'review') setCurrentStep('form');
  }, [currentStep]);

  const restart = useCallback(() => {
    setSelectedNumber(null);
    setFormData(EMPTY_FORM);
    setPurchaseId(null);
    setPaymentId(null);
    setError(null);
    setCurrentStep('hero');
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
    loadNumbers();
  }, [loadNumbers]);

  // === Render ===

  if (!raffleConfig) {
    return (
      <PageContainer>
        <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">
          Cargando…
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {currentStep === 'hero' && <div>Hero placeholder</div>}
      {currentStep === 'grid' && <div>Grid placeholder</div>}
      {currentStep === 'form' && <div>Form placeholder</div>}
      {currentStep === 'review' && <div>Review placeholder</div>}
      {currentStep === 'success' && <div>Success placeholder</div>}
      {currentStep === 'failure' && <div>Failure placeholder</div>}
      {currentStep === 'pending' && <div>Pending placeholder</div>}
    </PageContainer>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build verde. La app productiva pasa a renderear "Cargando…" → "Hero placeholder" cuando se monte localmente.

- [ ] **Step 3: Smoke local**

Run: `npm run dev`. Abrir `http://localhost:3000`. Confirmar que:
- Se muestra "Hero placeholder" después del fetch a `/api/raffle/config`.
- En consola del browser no hay errors.
- En DevTools Network, `/api/raffle/config` y `/api/numbers` se llaman cada 30s.

- [ ] **Step 4: Commit**

```bash
git add components/RifasApp.tsx
git commit -m "refactor(ui): RifasApp slim shell con state + step routing + API wrappers"
```

---

## Task 2: HeroLanding (pantalla 1)

**Files:**
- Create: `components/hero/HeroLanding.tsx`
- Modify: `components/RifasApp.tsx` — reemplazar `<div>Hero placeholder</div>` por `<HeroLanding ... />`

- [ ] **Step 1: Crear `components/hero/HeroLanding.tsx`**

```tsx
import AppHeader from '../layout/AppHeader';

interface HeroLandingProps {
  raffleTitle: string;
  pricePerNumber: number;
  totalNumbers: number;
  availableCount: number;
  onStart: () => void;
}

export default function HeroLanding({
  raffleTitle,
  pricePerNumber,
  totalNumbers,
  availableCount,
  onStart,
}: HeroLandingProps) {
  const formattedPrice = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(pricePerNumber);

  const formattedAvailable = new Intl.NumberFormat('es-AR').format(availableCount);
  const formattedTotal = new Intl.NumberFormat('es-AR').format(totalNumbers);

  return (
    <>
      <AppHeader variant="hero" meta="2026" />

      <div className="flex-1 px-4 py-6 flex flex-col gap-3">
        <span className="self-start bg-brand-tint text-brand text-[10px] font-semibold tracking-[0.08em] uppercase px-2.5 py-1 rounded-chip">
          Rifa Anual · Edición 2026
        </span>

        <h1 className="text-[28px] sm:text-[32px] font-extrabold text-ink leading-[1.1] tracking-tight-2">
          La Gran Rifa<br />
          {raffleTitle.replace(/^Rifa Escolar /, '')}
        </h1>

        <p className="text-sm text-ink-soft leading-relaxed">
          Una tradición del colegio que vuelve un año más. Elegí tu número entre los {formattedTotal} disponibles y participá del sorteo.
        </p>

        <div className="mt-2 bg-surface-raised border border-line rounded-card p-3 flex gap-4 shadow-card">
          <div className="flex-1">
            <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.05em]">
              Precio
            </div>
            <div className="text-[22px] font-extrabold text-ink tracking-tight-2 leading-tight">
              {formattedPrice}
            </div>
          </div>
          <div className="w-px bg-line" />
          <div className="flex-1">
            <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.05em]">
              Disponibles
            </div>
            <div className="text-[22px] font-extrabold text-ink tracking-tight-2 leading-tight">
              {formattedAvailable}
              <span className="text-xs text-ink-muted font-medium ml-1">/ {formattedTotal}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-3 bg-brand text-white text-sm font-semibold py-3 px-4 rounded-ctl hover:bg-brand/90 transition-colors"
        >
          Elegir mi número →
        </button>

        <p className="text-[11px] text-ink-muted text-center mt-1">
          Pagás 100% online con MercadoPago
        </p>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Wire en `RifasApp.tsx`**

Modify the import block to add:

```tsx
import HeroLanding from './hero/HeroLanding';
```

Replace the line `{currentStep === 'hero' && <div>Hero placeholder</div>}` with:

```tsx
{currentStep === 'hero' && (
  <HeroLanding
    raffleTitle={raffleConfig.title}
    pricePerNumber={raffleConfig.pricePerNumber}
    totalNumbers={raffleConfig.totalNumbers}
    availableCount={numbers.filter((n) => n.status === 'available').length}
    onStart={goToGrid}
  />
)}
```

- [ ] **Step 3: Verificar build + smoke**

Run: `npm run build`
Expected: build verde.

Run: `npm run dev`. Abrir `http://localhost:3000`. Confirmar:
- Header azul royal con "STA" en círculo + "Colegio STA" + meta "2026".
- Título grande "La Gran Rifa Escolar 2026".
- Card con precio "$ 2.000" y disponibles "1.999 / 2.000".
- CTA azul "Elegir mi número →".
- Click en CTA → currentStep cambia a 'grid' (verás "Grid placeholder").

- [ ] **Step 4: Commit**

```bash
git add components/hero/HeroLanding.tsx components/RifasApp.tsx
git commit -m "feat(ui): pantalla 1 HeroLanding con precio + disponibles + CTA primario"
```

---

## Task 3: NumberCell + GridLegend (átomos visuales del grid)

**Files:**
- Create: `components/grid/NumberCell.tsx`
- Create: `components/grid/GridLegend.tsx`

- [ ] **Step 1: Crear `components/grid/NumberCell.tsx`**

```tsx
import { memo } from 'react';

export type NumberStatus = 'available' | 'reserved' | 'sold' | 'selected';

interface NumberCellProps {
  number: number;
  status: NumberStatus;
  onClick: (n: number) => void;
}

const STATUS_CLASSES: Record<NumberStatus, string> = {
  available: 'bg-state-available-bg text-state-available-fg hover:bg-state-available-bg/80 cursor-pointer',
  reserved: 'bg-state-reserved-bg text-state-reserved-fg cursor-not-allowed opacity-80',
  sold: 'bg-state-sold text-white cursor-not-allowed opacity-90',
  selected: 'bg-accent text-white font-bold ring-2 ring-accent-strong cursor-pointer',
};

function NumberCellInner({ number, status, onClick }: NumberCellProps) {
  const isInteractive = status === 'available' || status === 'selected';
  return (
    <button
      type="button"
      disabled={!isInteractive}
      onClick={isInteractive ? () => onClick(number) : undefined}
      className={`aspect-square rounded-chip flex items-center justify-center text-[11px] font-semibold transition-colors ${STATUS_CLASSES[status]}`}
      aria-label={`Número ${number}, ${status}`}
    >
      {number}
    </button>
  );
}

export default memo(NumberCellInner);
```

- [ ] **Step 2: Crear `components/grid/GridLegend.tsx`**

```tsx
interface LegendItemProps {
  colorClass: string;
  label: string;
}

function LegendItem({ colorClass, label }: LegendItemProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
      <span className={`inline-block w-2.5 h-2.5 rounded-[3px] ${colorClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export default function GridLegend() {
  return (
    <div className="flex gap-3 flex-wrap">
      <LegendItem colorClass="bg-state-available-bg" label="Disponible" />
      <LegendItem colorClass="bg-accent" label="Tuyo" />
      <LegendItem colorClass="bg-state-sold" label="Vendido" />
      <LegendItem colorClass="bg-state-reserved-bg" label="Reservado" />
    </div>
  );
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build verde. Los componentes compilan aunque no se usen aún.

- [ ] **Step 4: Commit**

```bash
git add components/grid/NumberCell.tsx components/grid/GridLegend.tsx
git commit -m "feat(ui): átomos del grid (NumberCell memoizado + GridLegend)"
```

---

## Task 4: NumberSearch + RangeTabs (entrada de navegación del grid)

**Files:**
- Create: `components/grid/NumberSearch.tsx`
- Create: `components/grid/RangeTabs.tsx`

- [ ] **Step 1: Crear `components/grid/NumberSearch.tsx`**

```tsx
import { Search } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface NumberSearchProps {
  totalNumbers: number;
  onFound: (n: number) => void;
}

export default function NumberSearch({ totalNumbers, onFound }: NumberSearchProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const n = Number(value.trim());
    if (!Number.isInteger(n) || n < 1 || n > totalNumbers) {
      setError(`Ingresá un número entre 1 y ${totalNumbers}`);
      return;
    }
    setError(null);
    onFound(n);
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="px-3 py-2 bg-surface-raised border-b border-line">
      <label className="flex items-center gap-2 bg-surface-raised border border-line rounded-ctl px-3 py-2 focus-within:border-brand transition-colors">
        <Search className="w-4 h-4 text-ink-muted" aria-hidden="true" />
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Buscá un número específico"
          className="flex-1 outline-none bg-transparent text-sm text-ink placeholder:text-ink-muted"
          aria-label="Buscar número"
        />
      </label>
      {error && <p className="text-xs text-state-sold mt-1">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Crear `components/grid/RangeTabs.tsx`**

```tsx
import { useEffect, useRef } from 'react';

interface RangeTabsProps {
  totalNumbers: number;
  rangeSize: number;
  activeRangeIndex: number;
  onSelect: (index: number) => void;
}

export default function RangeTabs({
  totalNumbers,
  rangeSize,
  activeRangeIndex,
  onSelect,
}: RangeTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const rangeCount = Math.ceil(totalNumbers / rangeSize);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const tab = activeRef.current;
      const container = containerRef.current;
      const tabLeft = tab.offsetLeft;
      const tabRight = tabLeft + tab.offsetWidth;
      const visibleLeft = container.scrollLeft;
      const visibleRight = visibleLeft + container.clientWidth;
      if (tabLeft < visibleLeft || tabRight > visibleRight) {
        container.scrollTo({ left: tabLeft - 16, behavior: 'smooth' });
      }
    }
  }, [activeRangeIndex]);

  return (
    <div className="bg-surface px-3 py-2 border-b border-line">
      <div ref={containerRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {Array.from({ length: rangeCount }, (_, i) => {
          const start = i * rangeSize + 1;
          const end = Math.min(start + rangeSize - 1, totalNumbers);
          const isActive = i === activeRangeIndex;
          return (
            <button
              key={i}
              ref={isActive ? activeRef : null}
              type="button"
              onClick={() => onSelect(i)}
              className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-chip transition-colors ${
                isActive
                  ? 'bg-brand text-white'
                  : 'bg-surface-raised text-ink-soft border border-line hover:border-brand'
              }`}
              aria-pressed={isActive}
            >
              {start}-{end}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build verde.

Nota: `scrollbar-hide` no es una clase Tailwind por default. Si el build se queja, agregar al `globals.css` (vía Edit, NO via plugin):

```css
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

Si el build pasa sin agregar nada, no agregues — algunos setups de Tailwind ya lo tienen.

- [ ] **Step 4: Commit**

```bash
git add components/grid/NumberSearch.tsx components/grid/RangeTabs.tsx app/globals.css
git commit -m "feat(ui): NumberSearch (input numérico con submit) + RangeTabs (20 rangos scrolleables)"
```

(Si NO agregaste la regla scrollbar-hide a globals.css, omitir ese path del git add.)

---

## Task 5: NumberGrid (pantalla 2 — orquestador)

**Files:**
- Create: `components/grid/NumberGrid.tsx`
- Modify: `components/RifasApp.tsx` — reemplazar `<div>Grid placeholder</div>` por `<NumberGrid ... />`

- [ ] **Step 1: Crear `components/grid/NumberGrid.tsx`**

```tsx
import { useMemo, useState } from 'react';
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import GridLegend from './GridLegend';
import NumberCell, { NumberStatus } from './NumberCell';
import NumberSearch from './NumberSearch';
import RangeTabs from './RangeTabs';
import type { RaffleNumber } from '../RifasApp';

const RANGE_SIZE = 100;

interface NumberGridProps {
  numbers: RaffleNumber[];
  totalNumbers: number;
  selectedNumber: number | null;
  pricePerNumber: number;
  onSelect: (n: number | null) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function NumberGrid({
  numbers,
  totalNumbers,
  selectedNumber,
  pricePerNumber,
  onSelect,
  onContinue,
  onBack,
}: NumberGridProps) {
  const [activeRangeIndex, setActiveRangeIndex] = useState(0);

  // Index status by number for O(1) lookup
  const statusByNumber = useMemo(() => {
    const map = new Map<number, NumberStatus>();
    numbers.forEach((n) => map.set(n.number, n.status));
    return map;
  }, [numbers]);

  const rangeStart = activeRangeIndex * RANGE_SIZE + 1;
  const rangeEnd = Math.min(rangeStart + RANGE_SIZE - 1, totalNumbers);
  const rangeNumbers = useMemo(() => {
    const arr: number[] = [];
    for (let n = rangeStart; n <= rangeEnd; n++) arr.push(n);
    return arr;
  }, [rangeStart, rangeEnd]);

  const formattedPrice = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(pricePerNumber);

  const handleSearch = (n: number) => {
    const idx = Math.floor((n - 1) / RANGE_SIZE);
    setActiveRangeIndex(idx);
    const status = statusByNumber.get(n);
    if (status === 'available') {
      onSelect(n);
    }
  };

  const handleCellClick = (n: number) => {
    if (selectedNumber === n) {
      onSelect(null);
    } else {
      onSelect(n);
    }
  };

  return (
    <>
      <AppHeader
        variant="wizard"
        title="Elegí tu número"
        meta={selectedNumber ? '1 sel.' : '0 sel.'}
        onBack={onBack}
      />

      <NumberSearch totalNumbers={totalNumbers} onFound={handleSearch} />
      <RangeTabs
        totalNumbers={totalNumbers}
        rangeSize={RANGE_SIZE}
        activeRangeIndex={activeRangeIndex}
        onSelect={setActiveRangeIndex}
      />

      <div className="flex-1 px-3 py-3 flex flex-col gap-3 overflow-y-auto">
        <GridLegend />
        <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
          {rangeNumbers.map((n) => {
            const baseStatus = statusByNumber.get(n) ?? 'available';
            const status: NumberStatus = selectedNumber === n ? 'selected' : baseStatus;
            return (
              <NumberCell
                key={n}
                number={n}
                status={status}
                onClick={handleCellClick}
              />
            );
          })}
        </div>
      </div>

      <StickyBottomBar>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-ink-muted">
            {selectedNumber ? `1 número · ${formattedPrice}` : 'Sin selección'}
          </div>
          {selectedNumber && (
            <span className="bg-brand-tint text-brand text-[11px] font-bold px-2 py-1 rounded-chip">
              {selectedNumber}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={!selectedNumber}
          onClick={onContinue}
          className="w-full bg-brand text-white text-sm font-semibold py-2.5 rounded-ctl hover:bg-brand/90 disabled:bg-ink-muted disabled:cursor-not-allowed transition-colors"
        >
          Continuar →
        </button>
      </StickyBottomBar>
    </>
  );
}
```

- [ ] **Step 2: Wire en `RifasApp.tsx`**

Add to import block:

```tsx
import NumberGrid from './grid/NumberGrid';
```

Replace `{currentStep === 'grid' && <div>Grid placeholder</div>}` with:

```tsx
{currentStep === 'grid' && (
  <NumberGrid
    numbers={numbers}
    totalNumbers={raffleConfig.totalNumbers}
    selectedNumber={selectedNumber}
    pricePerNumber={raffleConfig.pricePerNumber}
    onSelect={setSelectedNumber}
    onContinue={goToForm}
    onBack={goBack}
  />
)}
```

- [ ] **Step 3: Verificar build + smoke**

Run: `npm run build` → verde.

Run: `npm run dev`. En `http://localhost:3000`:
- Click "Elegir mi número →" desde el hero.
- Aparece header con back button + "Elegí tu número" + "0 sel.".
- Search bar funcional (escribir 5 + Enter → tab cambia a 1-100, scroll al 5).
- 20 tabs visibles (1-100 al 1.901-2.000).
- Grid de 100 celdas en el rango activo, en grid de 8 columnas (mobile) / 10 (≥640px).
- Click en celda disponible → se marca ámbar, sticky bar muestra número + "1 número · $ 2.000" + CTA habilitado.
- Click en otra celda disponible → se reemplaza la selección.
- Click en celda vendida (rojo) o reservada (gris) → no hace nada.
- CTA "Continuar →" → currentStep = 'form' (verás "Form placeholder").
- Back en header → vuelve a hero.

- [ ] **Step 4: Commit**

```bash
git add components/grid/NumberGrid.tsx components/RifasApp.tsx
git commit -m "feat(ui): pantalla 2 NumberGrid orquestadora con search + tabs + sticky CTA"
```

---

## Task 6: FormField + StudentBlock (átomos del form)

**Files:**
- Create: `components/form/FormField.tsx`
- Create: `components/form/StudentBlock.tsx`

- [ ] **Step 1: Crear `components/form/FormField.tsx`**

```tsx
import { ChangeEvent, InputHTMLAttributes } from 'react';

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'name'> {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
}

export default function FormField({
  label,
  name,
  value,
  onChange,
  error,
  ...inputProps
}: FormFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(name, e.target.value);
  };
  const id = `field-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-[10px] font-semibold text-ink-soft uppercase tracking-[0.04em]"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        className={`bg-surface-raised border rounded-ctl px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none transition-colors ${
          error ? 'border-state-sold' : 'border-line focus:border-brand'
        }`}
        {...inputProps}
      />
      {error && <span className="text-xs text-state-sold mt-0.5">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Crear `components/form/StudentBlock.tsx`**

```tsx
import FormField from './FormField';

interface StudentBlockProps {
  studentName: string;
  course: string;
  division: string;
  onChange: (name: string, value: string) => void;
  errors?: Partial<Record<'studentName' | 'course' | 'division', string>>;
}

export default function StudentBlock({
  studentName,
  course,
  division,
  onChange,
  errors,
}: StudentBlockProps) {
  return (
    <div className="bg-brand-tint rounded-banner p-3 mt-2 flex flex-col gap-2">
      <div className="text-[11px] font-bold text-brand">Estudiante del colegio</div>
      <p className="text-[11px] text-ink-soft">
        Para que el premio vuelva al curso correcto.
      </p>
      <div className="flex gap-2">
        <div className="flex-1">
          <FormField
            label="Estudiante"
            name="studentName"
            value={studentName}
            onChange={onChange}
            placeholder="Nombre"
            error={errors?.studentName}
            autoComplete="off"
          />
        </div>
        <div className="w-[60px]">
          <FormField
            label="Año"
            name="course"
            value={course}
            onChange={onChange}
            placeholder="Año"
            error={errors?.course}
            inputMode="numeric"
            maxLength={3}
            autoComplete="off"
          />
        </div>
        <div className="w-[52px]">
          <FormField
            label="Div."
            name="division"
            value={division}
            onChange={onChange}
            placeholder="A"
            error={errors?.division}
            maxLength={2}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 4: Commit**

```bash
git add components/form/FormField.tsx components/form/StudentBlock.tsx
git commit -m "feat(ui): átomos del form (FormField + StudentBlock diferenciado)"
```

---

## Task 7: BuyerForm (pantalla 3)

**Files:**
- Create: `components/form/BuyerForm.tsx`
- Modify: `components/RifasApp.tsx` — reemplazar `<div>Form placeholder</div>` por `<BuyerForm ... />`

- [ ] **Step 1: Crear `components/form/BuyerForm.tsx`**

```tsx
import { useState } from 'react';
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import FormField from './FormField';
import StudentBlock from './StudentBlock';
import type { FormData } from '../RifasApp';

interface BuyerFormProps {
  initialValue: FormData;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (data: FormData) => void;
  onBack: () => void;
}

type FieldErrors = Partial<Record<keyof FormData, string>>;

function validate(data: FormData): FieldErrors {
  const errors: FieldErrors = {};
  if (!data.buyerName.trim()) errors.buyerName = 'Requerido';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email.trim())) errors.email = 'Email inválido';
  if (!data.phone.trim()) errors.phone = 'Requerido';
  if (!data.studentName.trim()) errors.studentName = 'Requerido';
  if (!data.course.trim()) errors.course = 'Requerido';
  if (!data.division.trim()) errors.division = 'Requerido';
  return errors;
}

export default function BuyerForm({
  initialValue,
  isSubmitting,
  errorMessage,
  onSubmit,
  onBack,
}: BuyerFormProps) {
  const [data, setData] = useState<FormData>(initialValue);
  const [errors, setErrors] = useState<FieldErrors>({});

  const handleChange = (name: string, value: string) => {
    setData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(data);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="contents">
      <AppHeader variant="wizard" title="Tus datos" meta="2 / 4" onBack={onBack} />

      <div className="flex-1 px-4 py-5 flex flex-col gap-3 overflow-y-auto">
        <h2 className="text-lg font-bold text-ink leading-tight tracking-tight-1">
          ¿A nombre de quién va el número?
        </h2>
        <p className="text-xs text-ink-soft -mt-1">
          Si ganás te contactamos por estos datos.
        </p>

        <FormField
          label="Nombre del comprador"
          name="buyerName"
          value={data.buyerName}
          onChange={handleChange}
          placeholder="Tu nombre completo"
          error={errors.buyerName}
          autoComplete="name"
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          value={data.email}
          onChange={handleChange}
          placeholder="tucorreo@gmail.com"
          error={errors.email}
          autoComplete="email"
          inputMode="email"
        />
        <FormField
          label="Teléfono"
          name="phone"
          type="tel"
          value={data.phone}
          onChange={handleChange}
          placeholder="+54 9 11 …"
          error={errors.phone}
          autoComplete="tel"
          inputMode="tel"
        />

        <StudentBlock
          studentName={data.studentName}
          course={data.course}
          division={data.division}
          onChange={handleChange}
          errors={{
            studentName: errors.studentName,
            course: errors.course,
            division: errors.division,
          }}
        />

        {errorMessage && (
          <div className="bg-state-sold/10 border border-state-sold text-state-sold rounded-banner px-3 py-2 text-xs">
            {errorMessage}
          </div>
        )}
      </div>

      <StickyBottomBar>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-brand text-white text-sm font-semibold py-2.5 rounded-ctl hover:bg-brand/90 disabled:bg-ink-muted disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Reservando…' : 'Revisar compra →'}
        </button>
      </StickyBottomBar>
    </form>
  );
}
```

- [ ] **Step 2: Wire en `RifasApp.tsx`**

Add to import block:

```tsx
import BuyerForm from './form/BuyerForm';
```

Replace `{currentStep === 'form' && <div>Form placeholder</div>}` with:

```tsx
{currentStep === 'form' && (
  <BuyerForm
    initialValue={formData}
    isSubmitting={isLoading}
    errorMessage={error}
    onSubmit={(data) => {
      setFormData(data);
      void goToReview();
    }}
    onBack={goBack}
  />
)}
```

Note: `goToReview` triggers `createPurchase` which switches to `currentStep = 'review'` on success. The form's `onSubmit` updates formData first, then awaits via `void`-pattern (we don't need to chain since createPurchase already updates state).

Wait — there's a sequencing issue: `setFormData(data)` is async (state update), and `goToReview` reads `formData` from RifasApp's closure (might be stale). To avoid that, restructure: pass the latest `data` directly into the API call.

Update RifasApp `goToReview` to accept the form data directly:

```tsx
const goToReview = useCallback(async (latestForm: FormData) => {
  if (!selectedNumber || !raffleConfig) return;
  await createPurchase(latestForm, selectedNumber, raffleConfig.pricePerNumber);
}, [selectedNumber, raffleConfig, createPurchase]);
```

And in the wire:

```tsx
{currentStep === 'form' && (
  <BuyerForm
    initialValue={formData}
    isSubmitting={isLoading}
    errorMessage={error}
    onSubmit={(data) => {
      setFormData(data);
      void goToReview(data);
    }}
    onBack={goBack}
  />
)}
```

- [ ] **Step 3: Verificar build + smoke**

Run: `npm run build` → verde.

Run: `npm run dev`. En `http://localhost:3000`:
- Hero → grid → seleccionar un número → click "Continuar →".
- Aparece form con header "Tus datos" + meta "2 / 4".
- Inputs: nombre comprador, email, teléfono, + bloque estudiante con 3 campos (nombre, año, división) en fondo `brand-tint`.
- Submit con campos vacíos → muestra errores inline rojos.
- Submit con datos válidos → CTA pasa a "Reservando…", reserva el número via `/api/purchase`, salta a `currentStep = 'review'` (verás "Review placeholder").
- Si la API rechaza el número (race condition) → vuelve a 'grid' con error visible.
- Back → vuelve a 'grid' manteniendo selección.

- [ ] **Step 4: Commit**

```bash
git add components/form/BuyerForm.tsx components/RifasApp.tsx
git commit -m "feat(ui): pantalla 3 BuyerForm con validación inline + bloque estudiante"
```

---

## Task 8: PurchaseReview (pantalla 4)

**Files:**
- Create: `components/review/PurchaseReview.tsx`
- Modify: `components/RifasApp.tsx` — reemplazar `<div>Review placeholder</div>` por `<PurchaseReview ... />`

- [ ] **Step 1: Crear `components/review/PurchaseReview.tsx`**

```tsx
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import type { FormData } from '../RifasApp';

interface PurchaseReviewProps {
  selectedNumber: number;
  pricePerNumber: number;
  formData: FormData;
  isPaying: boolean;
  errorMessage: string | null;
  onPay: () => void;
  onBack: () => void;
}

interface RowProps {
  label: string;
  value: string;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="flex justify-between py-2 border-b border-line text-xs last:border-b-0">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink font-semibold text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}

export default function PurchaseReview({
  selectedNumber,
  pricePerNumber,
  formData,
  isPaying,
  errorMessage,
  onPay,
  onBack,
}: PurchaseReviewProps) {
  const formattedTotal = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(pricePerNumber);

  const studentLine = `${formData.studentName} · ${formData.course}°${formData.division}`;

  return (
    <>
      <AppHeader variant="wizard" title="Revisá tu compra" meta="3 / 4" onBack={onBack} />

      <div className="flex-1 px-4 py-5 flex flex-col gap-3 overflow-y-auto">
        <h2 className="text-lg font-bold text-ink tracking-tight-1">Última revisión</h2>

        <div className="bg-surface-raised border border-line rounded-card p-3 shadow-card">
          <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.05em] mb-2">
            Tu número
          </div>
          <span className="bg-brand-tint text-brand text-2xl font-extrabold tracking-tight-2 px-3 py-1.5 rounded-chip inline-block">
            {selectedNumber}
          </span>
        </div>

        <div className="bg-surface-raised border border-line rounded-card px-3 py-2 shadow-card">
          <Row label="Comprador" value={formData.buyerName} />
          <Row label="Email" value={formData.email} />
          <Row label="Estudiante" value={studentLine} />
          <Row label="Total" value={formattedTotal} />
        </div>

        <div className="bg-state-warning-bg border border-state-warning-border text-state-warning-fg rounded-banner px-3 py-2 text-[11px] leading-relaxed">
          ⏱ Tu número queda reservado <strong>15 minutos</strong>. Si no completás el pago, vuelve a estar disponible.
        </div>

        {errorMessage && (
          <div className="bg-state-sold/10 border border-state-sold text-state-sold rounded-banner px-3 py-2 text-xs">
            {errorMessage}
          </div>
        )}
      </div>

      <StickyBottomBar>
        <button
          type="button"
          disabled={isPaying}
          onClick={onPay}
          className="w-full bg-mp-blue text-white text-sm font-semibold py-2.5 rounded-ctl hover:opacity-90 disabled:bg-ink-muted disabled:cursor-not-allowed transition-opacity"
        >
          {isPaying ? 'Redirigiendo…' : 'Pagar con MercadoPago →'}
        </button>
        <p className="text-[10px] text-ink-muted text-center mt-1.5">
          🔒 Pago seguro · MercadoPago
        </p>
      </StickyBottomBar>
    </>
  );
}
```

- [ ] **Step 2: Wire en `RifasApp.tsx`**

Add to import block:

```tsx
import PurchaseReview from './review/PurchaseReview';
```

Replace `{currentStep === 'review' && <div>Review placeholder</div>}` with:

```tsx
{currentStep === 'review' && selectedNumber !== null && (
  <PurchaseReview
    selectedNumber={selectedNumber}
    pricePerNumber={raffleConfig.pricePerNumber}
    formData={formData}
    isPaying={isLoading}
    errorMessage={error}
    onPay={startPayment}
    onBack={goBack}
  />
)}
```

- [ ] **Step 3: Verificar build + smoke**

Run: `npm run build` → verde.

Run: `npm run dev`. Llegar hasta review (hero → grid → form completo → "Revisar compra"). Confirmar:
- Card con número seleccionado en chip ámbar.
- Tabla con comprador / email / estudiante / total formateado.
- Banner ámbar de timeout 15 min.
- CTA azul MP "Pagar con MercadoPago →".
- Click en CTA → redirige a `init_point` de MP (o aborta si MP rechaza).

⚠️ Nota: NO completar el pago real durante smoke local — quedaría una purchase pendiente que conviene cancelar manualmente. Si el dev server tiene credenciales TEST de MP, OK.

- [ ] **Step 4: Commit**

```bash
git add components/review/PurchaseReview.tsx components/RifasApp.tsx
git commit -m "feat(ui): pantalla 4 PurchaseReview con número grande + tabla + warning timeout"
```

---

## Task 9: SuccessScreen + FailureScreen + PendingScreen + payment routes fix

**Files:**
- Create: `components/status/SuccessScreen.tsx`
- Create: `components/status/FailureScreen.tsx`
- Create: `components/status/PendingScreen.tsx`
- Modify: `components/RifasApp.tsx` — reemplazar 3 placeholders
- Modify: `app/api/payment/success/route.ts` — fallback URL al Cloud Run
- Modify: `app/api/payment/failure/route.ts` — fallback URL al Cloud Run
- Modify: `app/api/payment/pending/route.ts` — fallback URL al Cloud Run

- [ ] **Step 1: Crear `components/status/SuccessScreen.tsx`**

```tsx
import { Check, MessageCircle } from 'lucide-react';
import AppHeader from '../layout/AppHeader';

interface SuccessScreenProps {
  number: number;
  email: string;
  raffleTitle: string;
  onShareWhatsApp: () => void;
  onRestart: () => void;
}

function pad4(n: number) {
  return String(n).padStart(4, '0');
}

export default function SuccessScreen({
  number,
  email,
  raffleTitle,
  onShareWhatsApp,
  onRestart,
}: SuccessScreenProps) {
  return (
    <>
      <AppHeader variant="hero" meta="2026" />

      <div className="flex-1 px-4 py-8 flex flex-col items-center text-center gap-3">
        <div
          className="w-16 h-16 bg-state-available-bg rounded-full flex items-center justify-center"
          aria-hidden="true"
        >
          <Check className="w-8 h-8 text-state-available-fg" />
        </div>

        <h1 className="text-3xl font-extrabold text-ink tracking-tight-2 leading-tight">
          ¡Tu número es tuyo!
        </h1>
        <p className="text-sm text-ink-soft">
          El pago se confirmó. Te mandamos el comprobante a <strong>{email}</strong>.
        </p>

        <div className="mt-4 bg-surface-raised border-2 border-accent rounded-card-lg p-5 w-full">
          <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.05em]">
            Tu número
          </div>
          <div className="text-6xl font-black text-brand tracking-tight-4 leading-none">
            {pad4(number)}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">{raffleTitle} · Sorteo: a definir</div>
        </div>

        <button
          type="button"
          onClick={onShareWhatsApp}
          className="w-full bg-surface-raised text-brand border-[1.5px] border-brand rounded-ctl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-brand-tint transition-colors mt-2"
        >
          <MessageCircle className="w-4 h-4" aria-hidden="true" />
          Compartir por WhatsApp
        </button>

        <button
          type="button"
          onClick={onRestart}
          className="text-xs text-ink-muted underline mt-1"
        >
          ¿Querés otro número? Volver al inicio →
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Crear `components/status/FailureScreen.tsx`**

```tsx
import { AlertCircle } from 'lucide-react';
import AppHeader from '../layout/AppHeader';

interface FailureScreenProps {
  number: number | null;
  onRestart: () => void;
}

export default function FailureScreen({ number, onRestart }: FailureScreenProps) {
  return (
    <>
      <AppHeader variant="hero" meta="2026" />

      <div className="flex-1 px-4 py-8 flex flex-col items-center text-center gap-3">
        <div
          className="w-16 h-16 bg-state-sold/10 rounded-full flex items-center justify-center"
          aria-hidden="true"
        >
          <AlertCircle className="w-8 h-8 text-state-sold" />
        </div>

        <h1 className="text-2xl font-extrabold text-ink tracking-tight-2 leading-tight">
          Hubo un problema con el pago
        </h1>
        <p className="text-sm text-ink-soft">
          MercadoPago no pudo procesar tu pago. {number !== null && (
            <>
              Tu número <strong>{number}</strong> sigue disponible si querés intentar de nuevo en los próximos 15 minutos.
            </>
          )}
        </p>

        <button
          type="button"
          onClick={onRestart}
          className="w-full bg-brand text-white py-2.5 rounded-ctl text-sm font-semibold mt-3 hover:bg-brand/90 transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Crear `components/status/PendingScreen.tsx`**

```tsx
import { Clock } from 'lucide-react';
import AppHeader from '../layout/AppHeader';

interface PendingScreenProps {
  onRestart: () => void;
}

export default function PendingScreen({ onRestart }: PendingScreenProps) {
  return (
    <>
      <AppHeader variant="hero" meta="2026" />

      <div className="flex-1 px-4 py-8 flex flex-col items-center text-center gap-3">
        <div
          className="w-16 h-16 bg-accent/15 rounded-full flex items-center justify-center"
          aria-hidden="true"
        >
          <Clock className="w-8 h-8 text-accent" />
        </div>

        <h1 className="text-2xl font-extrabold text-ink tracking-tight-2 leading-tight">
          Tu pago está en proceso
        </h1>
        <p className="text-sm text-ink-soft">
          MercadoPago aún está confirmando tu pago. En cuanto se confirme te llega el comprobante por email. Podés cerrar esta pantalla.
        </p>

        <button
          type="button"
          onClick={onRestart}
          className="w-full bg-surface-raised text-brand border-[1.5px] border-brand py-2.5 rounded-ctl text-sm font-semibold mt-3 hover:bg-brand-tint transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Wire en `RifasApp.tsx`**

Add to import block:

```tsx
import SuccessScreen from './status/SuccessScreen';
import FailureScreen from './status/FailureScreen';
import PendingScreen from './status/PendingScreen';
```

Add a memo / handler for WhatsApp share inside `RifasApp`:

```tsx
const shareWhatsApp = useCallback(() => {
  if (!selectedNumber || !raffleConfig) return;
  const text = `¡Tengo el número ${String(selectedNumber).padStart(4, '0')} en ${raffleConfig.title}! 🎟`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}, [selectedNumber, raffleConfig]);
```

Replace the 3 status placeholders with:

```tsx
{currentStep === 'success' && selectedNumber !== null && (
  <SuccessScreen
    number={selectedNumber}
    email={formData.email}
    raffleTitle={raffleConfig.title}
    onShareWhatsApp={shareWhatsApp}
    onRestart={restart}
  />
)}
{currentStep === 'failure' && (
  <FailureScreen number={selectedNumber} onRestart={restart} />
)}
{currentStep === 'pending' && (
  <PendingScreen onRestart={restart} />
)}
```

⚠️ Caveat: cuando el usuario regresa de MP via redirect de `/api/payment/success?purchase=PUR-xxx&payment_id=...`, el `selectedNumber` y `formData.email` quedan vacíos en el state local (la página se recargó y perdió React state). Para Fase 5.B la solución pragmática es:
- En el effect que detecta `?payment=...`, fetchear `/api/purchase/${purchase}` para hidratar selectedNumber + email del comprador.

Add a new API call wrapper to `RifasApp.tsx` (junto a los otros) — y también un endpoint si no existe. Verificar primero si existe `/api/purchase/[id]` GET handler. Si NO existe:

Skip rebuild del backend en este task — alternativa simpler para Fase 5.B: cuando llegue el redirect de success, mostrar el mensaje genérico SIN el número específico (el comprobante MP ya lo tiene). Después en 5.C se puede agregar el endpoint y rehidratar.

Versión simplificada: cambiar `SuccessScreen`'s prop `number` para aceptar opcional, y mostrar "Revisá tu mail" con el número desde el comprobante MP. Para no agrandar el plan, mantenelo opcional:

Modify `SuccessScreen` interface — change `number: number;` to `number?: number;` and conditionally render the number card only when present.

- [ ] **Step 5: Modificar `SuccessScreen` para number opcional**

Change the interface to `number?: number;`. Wrap the big number card in `{number !== undefined && (...)}`. If undefined, show fallback text "Revisá tu correo para ver el número".

- [ ] **Step 6: Modificar payment route fallbacks**

In `app/api/payment/success/route.ts`, change line 32 from:

```ts
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas.vercel.app';
```

to:

```ts
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app';
```

Apply identical change in `app/api/payment/failure/route.ts:26` and `app/api/payment/pending/route.ts:26`.

- [ ] **Step 7: Verificar build**

Run: `npm run build` → verde.

- [ ] **Step 8: Commit**

```bash
git add components/status/ components/RifasApp.tsx app/api/payment/
git commit -m "feat(ui): pantallas 5 (Success/Failure/Pending) + fallback URLs Cloud Run"
```

---

## Task 10: Wire final + delete legacy + cleanup nits 5.A

**Files:**
- Modify: `components/RifasApp.tsx` — final cleanup (any remaining placeholders)
- Modify: `tailwind.config.js` — remover `animation.spin-slow` y `backgroundImage.gradient-radial` sin uso
- Modify: `components/layout/StickyBottomBar.tsx` — flatten template literal multi-línea
- Modify: `components/layout/PageContainer.tsx` — `min-h-screen` → `min-h-dvh`

- [ ] **Step 1: Verificar que `RifasApp.tsx` ya no tiene placeholders**

Read the file. If any `<div>...placeholder</div>` remains, replace with the appropriate component import from Tasks 2-9.

- [ ] **Step 2: Limpiar `tailwind.config.js`**

Open `tailwind.config.js`. Remove these blocks (declaraciones sin consumidores en `components/`/`app/`):

```js
animation: {
  'spin-slow': 'spin 3s linear infinite',
},
backgroundImage: {
  'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
},
```

If `lucide-react`'s `animate-spin` covers loading needs in the new screens (it does), the legacy `spin-slow` is dead. `gradient-radial` was never used.

- [ ] **Step 3: Aplanar `components/layout/StickyBottomBar.tsx`**

Replace the multi-line template literal:

```tsx
className={`
  sticky bottom-0 z-20
  bg-surface-raised
  ${withBorder ? 'border-t border-line' : ''}
  px-4 py-3
  ${className}
`}
```

with single-line template literal:

```tsx
className={`sticky bottom-0 z-20 bg-surface-raised ${withBorder ? 'border-t border-line' : ''} px-4 py-3 ${className}`}
```

Result: cleaner DOM (no \n inside class attribute) y consistente con `PageContainer` y `AppHeader`.

- [ ] **Step 4: Migrar `min-h-screen` → `min-h-dvh` en `PageContainer.tsx`**

In `components/layout/PageContainer.tsx`, change:

```tsx
<div className={`mx-auto w-full max-w-[560px] min-h-screen flex flex-col ${className}`}>
```

to:

```tsx
<div className={`mx-auto w-full max-w-[560px] min-h-dvh flex flex-col ${className}`}>
```

`min-h-dvh` (dynamic viewport height) evita el "saltito" de la barra de URL en mobile Safari cuando aparece/desaparece. Tailwind 3.4 lo soporta nativo.

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.js components/layout/PageContainer.tsx components/layout/StickyBottomBar.tsx
git commit -m "chore(ui): cleanup nits 5.A (min-h-dvh + flatten template + drop tokens sin uso)"
```

---

## Task 11: Validación final + push

**Files:** ninguno modificado en este task (solo gates).

- [ ] **Step 1: Lint final**

Run: `npm run lint`
Expected: 0 errors. Las warnings de `react-hooks/exhaustive-deps` que existían en el RifasApp.tsx legacy (líneas 662, 680) **no deberían existir más** — el RifasApp nuevo está bien tipado. Si aparecen warnings nuevas, revisar.

- [ ] **Step 2: Build final**

Run: `npm run build`
Expected: 7 rutas API + página principal compilan sin errores. Bundle size: revisar que `/` no haya crecido más de ~50% vs el baseline (era 9.22 kB; el nuevo va a ser similar o menor por la modularización).

- [ ] **Step 3: Concurrency test**

Levantar dev server en una terminal:
```bash
npm run dev
```

En otra terminal correr:
```bash
node run-concurrency-test.js
```

Expected: el test pasa (los cambios UI no tocan `raffleService.ts` ni schema, así que la lógica anti-sobreventa es idéntica).

Si el test falla por estar usando un schema legacy del monolito, OK skipear (la lógica server no cambió). Documentar el resultado en el commit message del Task 11.

- [ ] **Step 4: Listar commits desde el último save**

Run: `git log origin/main..HEAD --oneline`
Expected: ~10 commits con prefijos `feat(ui):`, `refactor(ui):`, `chore(ui):` correspondientes a los Tasks 1-10.

- [ ] **Step 5: Smoke en mobile real (manual)**

Esto NO se hace via subagent — es manual del usuario. Antes de pushear, levantar `npm run dev` con `--host 0.0.0.0` (o usar `next dev -H 0.0.0.0`), abrir desde un iPhone real conectado a la misma red:

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Probar el flujo completo en iPhone Safari y Android Chrome:
- Hero render → CTA tap.
- Grid → tabs scroll horizontal → search → seleccionar número.
- Form → llenar campos → submit.
- Review → ver número grande → tap "Pagar con MP" (NO completar pago real en local).
- Volver con back manual del browser.

Si todo OK, proceder al push. Si hay regresión visual, abrir como tarea cleanup en una iteración futura — no bloquear el merge.

- [ ] **Step 6: Push**

```bash
git push origin main
```

(o si se usó worktree con branch `rediseno-ui/fase-5b`: `git push origin rediseno-ui/fase-5b` y abrir PR contra main).

- [ ] **Step 7: Verificar producción**

```bash
curl -sS https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/api/raffle/config | python3 -m json.tool
```

Expected: respuesta JSON con la rifa 2026. Cloud Run **NO redeploya automáticamente** — el rediseño no llega a producción hasta que se haga deploy manual con `./scripts/deploy.sh`. El deploy se hace en Fase 5.D (validación + deploy + compra real).

---

## Validación de "done" para Fase 5.B

Al cerrar este plan tiene que ser cierto:

- ✅ `components/RifasApp.tsx` tiene ~250 líneas (vs 1.587 originales) y delega todo el render visual a sub-componentes.
- ✅ Existen los 13 componentes nuevos: 1 Hero + 5 Grid + 3 Form + 1 Review + 3 Status.
- ✅ Las 4 routes de payment (`success`, `failure`, `pending`) tienen fallback Cloud Run.
- ✅ Los 4 nits de 5.A están cerrados (`min-h-dvh`, flatten template literal, drop tokens sin uso, ya removida la palette legacy en 5.A).
- ✅ `npm run lint` y `npm run build` pasan.
- ✅ Smoke manual en iPhone/Android Chrome confirmó el flujo completo.
- ✅ ~10 commits pusheados a main (o feature branch si se usó worktree).
- ✅ La app productiva en Cloud Run sigue corriendo la revision anterior (no hay deploy en 5.B).

---

## Próximo paso después de 5.B

**Fase 5.C** — Panel admin con basic auth. Plan futuro:
- Middleware Next.js que intercepta `/admin/*` y valida basic auth contra env vars.
- Componentes de stats cards + 3 tabs (Compras, Estados grilla, Logs).
- Endpoint `/api/admin/export-csv` para descarga de compras.
- Setear `ADMIN_USERNAME` + `ADMIN_PASSWORD` en Secret Manager.

**Fase 5.D** — Validación cross-device + deploy + compra real. Plan corto:
- Smoke en mobile real con dev server.
- Concurrency test post-rediseño (debería pasar idéntico al pre-rediseño porque no se tocó server).
- Deploy a Cloud Run vía `./scripts/deploy.sh`.
- Smoke E2E productivo con compra real $2.000 (la 2da, después de la de Romi en Fase 4.2).

**Fase 5.E** — Logo SVG y hex institucionales reales. 1-2 commits cortos.

---

## Notas operativas

- **Worktree recomendado** para Fase 5.B (ver sección al inicio). El comando `git worktree add` permite trabajar en branch paralelo sin afectar `main`.
- **Si el implementer encuentra que el plan tiene un error**, levantar status BLOCKED en el reporte. No "rellenar" cosas que el plan no especifica.
- **Cualquier cambio futuro al monolito legacy `RifasApp.tsx`** se descartar — el archivo se reemplaza completo en Task 1. No hace sentido aplicar fixes al viejo durante 5.B.
- **Si el usuario pasa el logo SVG durante 5.B**: ajustar Task 2 (HeroLanding) y AppHeader inline — el `leftSlot` de AppHeader ya soporta cualquier ReactNode.
- **Si el usuario pasa hex institucionales reales durante 5.B**: cambiar `tailwind.config.js` (1-3 líneas) y todos los componentes se actualizan automáticamente vía tokens.
