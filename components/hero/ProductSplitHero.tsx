'use client';

import { Ticket, UtensilsCrossed } from 'lucide-react';
import PageContainer from '../layout/PageContainer';
import AppHeader from '../layout/AppHeader';
import { COMBOS } from '../../lib/combos';

interface ProductSplitHeroProps {
  raffleAvailable: number | null;
  rafflePrice: number | null;
  onSelect: (product: 'rifa' | 'combo') => void;
}

export default function ProductSplitHero({
  raffleAvailable,
  rafflePrice,
  onSelect,
}: ProductSplitHeroProps) {
  const formatPrice = (n: number | null) =>
    n === null ? '—' : `$${n.toLocaleString('es-AR')}`;

  return (
    <PageContainer>
      <AppHeader variant="hero" meta="2026" />
      <main className="px-5 pt-6 pb-10">
        <h1 className="text-2xl font-black tracking-tight text-ink mb-2">Apoyá el evento</h1>
        <p className="text-sm text-ink-muted mb-6">Elegí qué querés comprar</p>

        <div className="grid grid-cols-2 gap-3">
          {/* Rifa card */}
          <button
            type="button"
            onClick={() => onSelect('rifa')}
            className="rounded-2xl border-2 border-brand bg-surface-raised p-4 text-left flex flex-col items-start gap-2 transition active:scale-[0.98]"
            aria-label="Comprar número de rifa"
          >
            <Ticket className="h-7 w-7 text-brand" aria-hidden />
            <div className="text-sm font-bold text-ink">Número de rifa</div>
            <div className="text-xs text-ink-muted">
              {raffleAvailable !== null ? `${raffleAvailable} disp.` : 'Cargando…'}
            </div>
            <div className="text-lg font-black text-brand">{formatPrice(rafflePrice)}</div>
          </button>

          {/* Combo card — border-line is the closest token to border-ink-faint */}
          <button
            type="button"
            onClick={() => onSelect('combo')}
            className="rounded-2xl border border-line bg-surface-raised p-4 text-left flex flex-col items-start gap-2 transition active:scale-[0.98]"
            aria-label="Comprar combo de comida"
          >
            <UtensilsCrossed className="h-7 w-7 text-ink-soft" aria-hidden />
            <div className="text-sm font-bold text-ink">{COMBOS[0].name}</div>
            <div className="text-xs text-ink-muted">{COMBOS[0].description}</div>
            <div className="text-lg font-black text-ink">${COMBOS[0].price.toLocaleString('es-AR')}</div>
          </button>
        </div>
      </main>
    </PageContainer>
  );
}
