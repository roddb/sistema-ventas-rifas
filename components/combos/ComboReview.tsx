'use client';

import PageContainer from '../layout/PageContainer';
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import { COMBOS } from '../../lib/combos';
import type { ComboBuyer } from './ComboBuyerForm';

interface ComboReviewProps {
  cart: Record<string, number>;
  buyer: ComboBuyer;
  total: number;
  isLoading: boolean;
  error?: string | null;
  onConfirm: () => void;
  onBack: () => void;
}

export default function ComboReview({ cart, buyer, total, isLoading, error, onConfirm, onBack }: ComboReviewProps) {
  const items: { combo: typeof COMBOS[number]; quantity: number }[] = [];
  for (const combo of COMBOS) {
    const q = cart[combo.id] ?? 0;
    if (q > 0) items.push({ combo, quantity: q });
  }

  return (
    <PageContainer>
      <AppHeader variant="wizard" onBack={onBack} title="Revisar pedido" />
      <main className="px-5 pt-4 pb-32 flex flex-col gap-4">
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted mb-2">Tu pedido</h2>
          <div className="rounded-xl border border-line bg-surface-raised divide-y divide-line">
            {items.map(({ combo, quantity }) => (
              <div key={combo.id} className="flex items-center gap-3 p-3">
                <div className="text-2xl" aria-hidden>{combo.emoji}</div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-ink">{combo.name}</div>
                  <div className="text-xs text-ink-muted">{quantity} × ${combo.price.toLocaleString('es-AR')}</div>
                </div>
                <div className="text-sm font-extrabold text-ink">
                  ${(quantity * combo.price).toLocaleString('es-AR')}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-surface">
              <div className="text-sm font-bold text-ink">Total</div>
              <div className="text-lg font-black text-brand">${total.toLocaleString('es-AR')}</div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted mb-2">Tus datos</h2>
          <div className="rounded-xl border border-line bg-surface-raised p-3 text-sm text-ink space-y-1">
            <div><span className="text-ink-muted">Nombre:</span> {buyer.name}</div>
            <div><span className="text-ink-muted">Email:</span> {buyer.email}</div>
            <div><span className="text-ink-muted">Teléfono:</span> {buyer.phone}</div>
          </div>
        </section>

        <p className="text-xs text-ink-muted leading-relaxed">
          Al confirmar te redirigimos a MercadoPago. Después del pago volvés a esta página y te mostramos tu código de retiro.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
      </main>
      <StickyBottomBar>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={`w-full rounded-lg py-3 text-sm font-bold transition ${
            isLoading ? 'bg-ink-muted text-white cursor-wait opacity-60' : 'bg-brand text-white'
          }`}
        >
          {isLoading ? 'Redirigiendo…' : 'Pagar con MercadoPago →'}
        </button>
      </StickyBottomBar>
    </PageContainer>
  );
}
