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
    },
  },
  plugins: [],
}