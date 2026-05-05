# Rediseño UI — Fase 5.A — Fundamentos (Design Tokens + Layout Components) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establecer la base del rediseño UI: sistema de design tokens en Tailwind config + 3 componentes de layout (PageContainer, AppHeader, StickyBottomBar) que después usarán las pantallas en Fase 5.B. Sin tocar todavía la lógica del flujo de compra, sin tocar el monolito `RifasApp.tsx` viejo, sin romper la app productiva.

**Architecture:** Configuración de Tailwind extendida con todos los tokens del spec §3.2-3.4 (colores brand/surface/ink/accent/state, fontFamily Inter, radius, shadows). 3 componentes de layout en `components/layout/` que ofrecen API clara y mínima — el resto de pantallas se construyen sobre ellos sin reinventar el wrapper / header / sticky bar. Se preserva la palette `primary.50-900` actual para no romper el RifasApp.tsx viejo (que se reemplaza completo en Fase 5.B); cuando ese swap ocurra, se borrará `primary` del config.

**Tech Stack:** Next.js 14.2.5 App Router · TypeScript strict · Tailwind 3.4.7 · Inter via `next/font/google` · lucide-react para iconos.

**Spec de referencia:** `docs/superpowers/specs/2026-05-04-rediseno-ui-completo-design.md` (secciones 3.2 paleta, 3.3 tipografía, 3.4 spacing/elevation, 5 estructura de componentes).

**Validación:** No hay tests unitarios para componentes UI (decisión spec §11 — out of scope). La validación de cada task es `npm run lint` + `npm run build` verde. Smoke visual viene en Fase 5.B cuando los componentes se integran a las pantallas reales. Para verificación visual rápida durante 5.A, se puede correr `npm run dev` y crear temporalmente una página dev en `app/dev/components/page.tsx` (no se commitea — es scratch).

---

## Scope check

Este plan cubre solo **Fase 5.A** del spec (un sub-conjunto de la Fase 5 completa). Las fases siguientes (5.B pantallas públicas, 5.C admin, 5.D validación, 5.E logo + hex finales) son planes separados que se escribirán después de validar 5.A. Cada fase produce software working e independiente.

**No bloqueantes que el usuario pasa después** y NO afectan a 5.A:
- Logo SVG de STA
- Hex institucionales reales (si difieren del azul royal `#1E3A8A` y ámbar `#F59E0B` provisorios, se ajustan los tokens en una sola línea en una sesión futura).

---

## File structure

```
tailwind.config.js                       # MODIFY — agregar tokens del spec
app/layout.tsx                            # MODIFY — Inter con weights + variable CSS
app/globals.css                           # MODIFY — limpiar legacy gradients, mantener scrollbar custom
components/
└── layout/                               # CREATE — directorio nuevo
    ├── PageContainer.tsx                 # CREATE — wrapper con max-width responsive
    ├── AppHeader.tsx                     # CREATE — header sticky azul royal con variantes
    └── StickyBottomBar.tsx               # CREATE — wrapper sticky bottom con slot via children
```

**No se toca**: ningún archivo de `app/api/*`, `lib/*`, `components/RifasApp.tsx`, `next.config.js`, `Dockerfile`, `package.json`. La app productiva sigue funcionando idéntica al cierre de Fase 4.2.

---

## Task 1: Extender Tailwind config con design tokens

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Reescribir `tailwind.config.js` para agregar tokens del spec**

Reemplazar el contenido completo de `tailwind.config.js` con:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // === PALETA RIFA 2026 — design tokens (spec §3.2) ===
        brand: '#1E3A8A',
        'brand-tint': '#F0F4FF',
        surface: '#FAFBFD',
        'surface-raised': '#FFFFFF',
        line: '#E5E7EB',
        ink: '#0F1C3D',
        'ink-soft': '#475569',
        'ink-muted': '#6B7280',
        accent: '#F59E0B',
        'accent-strong': '#D97706',
        'state-available-bg': '#DCFCE7',
        'state-available-fg': '#15803D',
        'state-reserved-bg': '#E5E7EB',
        'state-reserved-fg': '#6B7280',
        'state-sold': '#DC2626',
        'state-warning-bg': '#FEF3C7',
        'state-warning-border': '#FCD34D',
        'state-warning-fg': '#78350F',
        'mp-blue': '#009EE3',
        // === LEGACY — usado por components/RifasApp.tsx (se remueve en Fase 5.B) ===
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      borderRadius: {
        // Sistema spec §3.4
        chip: '4px',
        ctl: '6px',     // botones, inputs
        banner: '8px',
        card: '10px',
        'card-lg': '14px',
      },
      boxShadow: {
        // Sombras suaves spec §3.4
        card: '0 1px 3px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.06)',
      },
      letterSpacing: {
        // spec §3.3
        'tight-1': '-0.01em',
        'tight-2': '-0.02em',
        'tight-4': '-0.04em',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Verificar que el config compila**

Run: `npm run build`
Expected: build verde, sin errores. La paleta `primary` sigue intacta así que `RifasApp.tsx` viejo compila sin cambios.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat(ui): extender tailwind config con design tokens del rediseño 2026"
```

---

## Task 2: Configurar Inter con todos los pesos via CSS variable

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Reescribir `app/layout.tsx` cargando Inter con weights y variable**

Reemplazar el contenido completo de `app/layout.tsx` con:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Rifa STA 2026',
  description: 'Comprá tu número de la Gran Rifa STA 2026.',
  keywords: 'rifa, STA, sorteo, números, colegio',
  authors: [{ name: 'Colegio STA' }],
  openGraph: {
    title: 'Rifa STA 2026',
    description: 'Comprá tu número de la Gran Rifa STA 2026.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans antialiased bg-surface text-ink">
        {children}
      </body>
    </html>
  );
}
```

**Cambios clave**:
- Inter ahora declara los 6 pesos del spec §3.3 (400/500/600/700/800/900). Antes cargaba solo regular.
- `variable: '--font-inter'` expone la fuente como CSS variable, consumida por `tailwind.config.js` Task 1 (`fontFamily.sans`).
- `<html>` recibe `inter.variable` (no `inter.className`) para que la variable esté disponible globalmente; `<body>` usa `font-sans` (de Tailwind) para aplicar la familia.
- `bg-surface` y `text-ink` aplican los tokens base globalmente.
- Metadata actualizada al rediseño 2026.

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build verde, sin errores TS, font Inter cargada con weights extras.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(ui): cargar Inter con pesos 400-900 + variable CSS para tokens"
```

---

## Task 3: Limpiar `app/globals.css` para usar tokens y remover legacy

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Reescribir `app/globals.css`**

Reemplazar el contenido completo de `app/globals.css` con:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Reset adicional sobre el de Tailwind preflight */
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Scrollbar custom (mobile y desktop) */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #f1f5f9;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 8px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Animación fade-in para transiciones de step en el wizard */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fadeIn {
  animation: fadeIn 0.25s ease-out;
}

/* Spinner legacy preservado por si algún componente lo sigue usando hasta Fase 5.B */
.spinner {
  border: 3px solid rgba(15, 28, 61, 0.1);
  border-radius: 50%;
  border-top: 3px solid #1E3A8A;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

**Cambios clave**:
- Removido el gradient legacy `--background-start-rgb` / `--background-end-rgb` (se reemplaza por `bg-surface` que aplicamos en `<body>` en Task 2).
- Removido el `@media (prefers-color-scheme: dark)` (no hay dark mode — spec §11 out of scope).
- Removida `.number-grid` global (los grids del rediseño se hacen con clases Tailwind en cada componente, no globales).
- Removida la transición global `*` de 150ms (era ruidosa y costosa; las transiciones específicas se aplican en cada componente).
- Scrollbar custom mantenido pero con paleta más fría que matchee tokens.
- `animate-fadeIn` mantenido y refinado (translateY(8px) en vez de 10px, duración 0.25s en vez de 0.3s).
- `.spinner` mantenido temporalmente (lo usa RifasApp.tsx viejo) con color brand actualizado.

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build verde, sin warnings de CSS.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): limpiar globals.css de legacy gradients y aplicar paleta brand"
```

---

## Task 4: Crear `PageContainer` (wrapper con max-width responsive)

**Files:**
- Create: `components/layout/PageContainer.tsx`

- [ ] **Step 1: Crear el archivo con el componente**

Crear `components/layout/PageContainer.tsx`:

```tsx
import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-[560px] min-h-screen flex flex-col ${className}`}>
      {children}
    </div>
  );
}
```

**Decisiones clave**:
- `max-w-[560px]` aplica el spec §3.9: la app vive como "una columna premium" en cualquier device. En mobile ocupa 100% del viewport (no afecta), en tablet/desktop centrado con margen automático.
- `min-h-screen flex flex-col` para que las pantallas con sticky bottom tengan altura mínima full y `flex-1` funcione en hijos.
- Single export default. Props mínimas (children + className override). Sin defensividad innecesaria.

- [ ] **Step 2: Verificar que TS compila**

Run: `npm run build`
Expected: build verde, el archivo nuevo no rompe nada porque aún no se usa.

- [ ] **Step 3: Commit**

```bash
git add components/layout/PageContainer.tsx
git commit -m "feat(ui): agregar PageContainer (wrapper max-width responsive)"
```

---

## Task 5: Crear `AppHeader` (header sticky azul royal con 3 variantes)

**Files:**
- Create: `components/layout/AppHeader.tsx`

- [ ] **Step 1: Crear el archivo con el componente**

Crear `components/layout/AppHeader.tsx`:

```tsx
import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface AppHeaderProps {
  /**
   * Variante de presentación del header.
   * - `hero`: muestra brand + meta. Usado en pantalla 1 (landing) y 5 (success/failure/pending).
   * - `wizard`: muestra back button + title + meta de paso. Usado en pantallas 2-4 (grid/form/review).
   */
  variant: 'hero' | 'wizard';
  /** Título central — solo se renderiza en variant=wizard. */
  title?: string;
  /** Texto del lado derecho — meta como "2 / 4", "1 sel.", "2026". */
  meta?: string;
  /** Callback al back button — solo en variant=wizard. */
  onBack?: () => void;
  /** Slot izquierdo del header en variant=hero — placeholder del logo STA. */
  leftSlot?: ReactNode;
}

export default function AppHeader({ variant, title, meta, onBack, leftSlot }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-brand text-white px-4 py-3 flex items-center justify-between">
      {variant === 'hero' ? (
        <div className="flex items-center gap-2">
          {leftSlot ?? (
            <div
              className="w-6 h-6 bg-white text-brand rounded-full flex items-center justify-center text-[9px] font-extrabold"
              aria-hidden="true"
            >
              STA
            </div>
          )}
          <span className="text-[13px] font-semibold tracking-tight-1">Colegio STA</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 -ml-1 px-1 py-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Volver al paso anterior"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span className="text-[13px] font-semibold tracking-tight-1">{title}</span>
        </button>
      )}

      {meta && <span className="text-[10px] opacity-85">{meta}</span>}
    </header>
  );
}
```

**Decisiones clave**:
- **Una sola componente con variantes** (en vez de 3 componentes distintos): la estructura del header es la misma (sticky azul + algo a la izq + meta a la derecha), solo cambia el contenido izquierdo. DRY.
- Variant `hero`: muestra brand + logo placeholder (4 chars "STA" en un círculo blanco). Cuando llegue el logo SVG, se pasa via `leftSlot={<Image src="/logo-sta.svg" .../>}` sin tocar el componente. Default sirve mientras tanto.
- Variant `wizard`: el header completo es un `<button>` clickeable (no un ícono separado) — área táctil grande, mobile-friendly. Usa `onBack` como callback (más flexible que href, porque el wizard mantiene state local en `RifasApp.tsx`).
- `aria-label` en el back button para screen readers.
- `hover:bg-white/10` da feedback visual en desktop sin ensuciar mobile.
- `z-30` para quedar por encima del contenido scrollable pero dejar room para modals (z-40+) si aparecen.
- Sin sombra en el header (lo separa del body el contraste de color).

- [ ] **Step 2: Verificar TS y build**

Run: `npm run build`
Expected: build verde. El componente compila aunque no se use todavía.

- [ ] **Step 3: Commit**

```bash
git add components/layout/AppHeader.tsx
git commit -m "feat(ui): agregar AppHeader (sticky brand con variantes hero/wizard)"
```

---

## Task 6: Crear `StickyBottomBar` (wrapper sticky inferior con slot)

**Files:**
- Create: `components/layout/StickyBottomBar.tsx`

- [ ] **Step 1: Crear el archivo con el componente**

Crear `components/layout/StickyBottomBar.tsx`:

```tsx
import { ReactNode } from 'react';

interface StickyBottomBarProps {
  children: ReactNode;
  /** Mostrar borde superior. Default true. Útil ponerlo false si la barra va sobre fondo brand. */
  withBorder?: boolean;
  className?: string;
}

export default function StickyBottomBar({ children, withBorder = true, className = '' }: StickyBottomBarProps) {
  return (
    <div
      className={`
        sticky bottom-0 z-20
        bg-surface-raised
        ${withBorder ? 'border-t border-line' : ''}
        px-4 py-3
        ${className}
      `}
    >
      {children}
    </div>
  );
}
```

**Decisiones clave**:
- Slot via `children`: cada pantalla compone su propio contenido (resumen + chip + CTA en grid; CTA solo en form / review). El componente solo aporta la mecánica de sticky + border + padding.
- `z-20` debajo del header (`z-30`) para evitar overlap si por algún motivo se rendean juntos en un flex inverso.
- `withBorder` opcional para casos futuros donde la barra va sobre un fondo no blanco.
- Padding consistente con el header (`px-4 py-3`).
- Mobile-first: en mobile el `sticky bottom-0` resuelve la barra fija sin posicionamiento absoluto manual. En desktop con `PageContainer max-w-[560px]` la barra queda contenida.

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 3: Commit**

```bash
git add components/layout/StickyBottomBar.tsx
git commit -m "feat(ui): agregar StickyBottomBar (slot wrapper para CTAs sticky)"
```

---

## Task 7: Validación final + push

**Files:** ninguno modificado en este task (solo gates de calidad).

- [ ] **Step 1: Lint final completo**

Run: `npm run lint`
Expected: pasa sin errores nuevos. Las 3 warnings de `react-hooks/exhaustive-deps` en `RifasApp.tsx` (líneas 629, 665, 683) son preexistentes y se cierran en Fase 5.B cuando se reemplaza el componente. No introducir warnings nuevas.

- [ ] **Step 2: Build final completo**

Run: `npm run build`
Expected: 7 rutas dinámicas + página principal compilan sin errores TypeScript. Tamaño del bundle similar al baseline (los 3 componentes nuevos no se importan todavía → tree-shaking los elimina del bundle final hasta Fase 5.B).

- [ ] **Step 3: Push de los 6 commits a `main`**

Run:
```bash
git log origin/main..HEAD --oneline
```
Expected: 6 commits desde el último `save:` previo, todos con prefijo `feat(ui):`.

```bash
git push origin main
```
Expected: push exitoso, GitHub recibe los 6 commits.

- [ ] **Step 4: Verificar que la app productiva sigue funcionando**

Run: `curl -sS https://sistema-ventas-rifas-kc5dasqukq-ue.a.run.app/api/raffle/config | python3 -m json.tool`
Expected: respuesta JSON con la rifa "Rifa Escolar 2026" / 2.000 / $2.000. El deploy productivo NO se actualiza automáticamente — Cloud Run sigue sirviendo la revision anterior. Los cambios de Fase 5.A no llegan a producción hasta que en Fase 5.B se haga el swap completo + deploy. Esto es deliberado.

---

## Validación de "done" para Fase 5.A

Al cerrar este plan tiene que ser cierto:

- ✅ `tailwind.config.js` exporta los 17 tokens nuevos del spec §3.2 (brand, surface, ink, accent, state-*, mp-blue, etc.) más fontFamily, borderRadius, boxShadow, letterSpacing.
- ✅ La palette `primary.50-900` legacy está intacta (RifasApp.tsx viejo sigue compilando).
- ✅ `app/layout.tsx` carga Inter con los 6 pesos del spec §3.3 y expone `--font-inter` como CSS variable consumida por `font-sans` de Tailwind.
- ✅ `app/globals.css` está limpio de gradientes legacy y dark-mode media query.
- ✅ Existe `components/layout/` con 3 archivos: `PageContainer.tsx`, `AppHeader.tsx`, `StickyBottomBar.tsx`.
- ✅ `npm run lint` y `npm run build` pasan en verde.
- ✅ 6 commits en main con prefijo `feat(ui):`.
- ✅ La app productiva en Cloud Run NO se afecta (no hay deploy en Fase 5.A).

---

## Próximo paso después de 5.A

Pasar a Fase 5.B: implementar las 5 pantallas del flujo público (Hero, Grid paginada, Form, Review, Success/Failure/Pending) usando los componentes de 5.A. El plan de 5.B se escribe con `superpowers:writing-plans` cuando 5.A esté validada y mergeada.

---

## Notas operativas

- **No es necesario worktree** para 5.A: solo se crean archivos nuevos + se modifican 3 archivos config no críticos (tailwind.config.js, app/layout.tsx, app/globals.css). La app productiva sigue funcionando idéntica porque el bundle compilado solo cambia en strings de tokens disponibles, no en código activo.
- **Sí conviene worktree para 5.B** cuando se haga el swap completo de RifasApp.tsx (1.587 líneas reemplazadas por ~15 archivos nuevos). Eso permite probar el rediseño aislado antes de mergear.
- **Si durante 5.A el usuario pasa el logo STA o los hex reales**: ajustar inline en Task 1 (cambio de 1-2 líneas en `tailwind.config.js`) o Task 5 (reemplazar el placeholder STA). No re-planificar.
