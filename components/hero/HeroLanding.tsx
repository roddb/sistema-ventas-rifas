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
