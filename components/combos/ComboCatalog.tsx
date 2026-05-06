'use client';

import { useMemo } from 'react';
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import ComboRow from './ComboRow';
import { COMBOS, calculateTotal, type CartItem } from '../../lib/combos';

interface ComboCatalogProps {
  cart: Record<string, number>;
  onChangeQuantity: (comboId: string, delta: number) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function ComboCatalog({ cart, onChangeQuantity, onContinue, onBack }: ComboCatalogProps) {
  const items: CartItem[] = useMemo(
    () => Object.entries(cart).map(([comboId, quantity]) => ({ comboId, quantity })),
    [cart],
  );

  const total = useMemo(() => calculateTotal(items), [items]);
  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const canContinue = totalCount > 0;

  return (
    <>
      <AppHeader variant="wizard" onBack={onBack} title="Combos del evento" />
      <main className="px-5 pt-4 pb-32 flex flex-col gap-2.5">
        {COMBOS.map((combo) => (
          <ComboRow
            key={combo.id}
            combo={combo}
            quantity={cart[combo.id] ?? 0}
            onIncrement={() => onChangeQuantity(combo.id, +1)}
            onDecrement={() => onChangeQuantity(combo.id, -1)}
          />
        ))}
      </main>
      <StickyBottomBar>
        <div className="flex items-center justify-between w-full">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-muted">
              Total · {totalCount} {totalCount === 1 ? 'combo' : 'combos'}
            </div>
            <div className="text-lg font-black text-ink">${total.toLocaleString('es-AR')}</div>
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className={`rounded-lg px-5 py-3 text-sm font-bold transition ${
              canContinue ? 'bg-brand text-white' : 'bg-ink-muted text-white cursor-not-allowed opacity-60'
            }`}
          >
            Continuar →
          </button>
        </div>
      </StickyBottomBar>
    </>
  );
}
