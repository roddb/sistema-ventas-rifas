'use client';

import { memo } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Combo } from '../../lib/combos';

interface ComboRowProps {
  combo: Combo;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

function ComboRow({ combo, quantity, onIncrement, onDecrement }: ComboRowProps) {
  const isActive = quantity > 0;

  return (
    <div className="rounded-xl border border-line bg-surface-raised p-3 flex items-center gap-3">
      <div className="text-3xl leading-none flex-shrink-0" aria-hidden>{combo.emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-ink leading-tight">{combo.name}</div>
        <div className="text-xs text-ink-muted mt-0.5">{combo.description}</div>
        <div className="text-sm font-extrabold text-brand mt-1">
          ${combo.price.toLocaleString('es-AR')}
        </div>
      </div>
      <div
        className={`flex items-center gap-2 rounded-full p-0.5 px-1 border ${
          isActive ? 'border-brand' : 'border-line'
        }`}
        role="group"
        aria-label={`Cantidad de ${combo.name}`}
      >
        <button
          type="button"
          onClick={onDecrement}
          disabled={quantity === 0}
          aria-label={`Quitar uno de ${combo.name}`}
          className={`h-7 w-7 rounded-full text-base font-bold transition flex items-center justify-center ${
            quantity === 0 ? 'text-ink-muted cursor-not-allowed' : 'text-brand'
          }`}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className={`text-sm font-extrabold min-w-[14px] text-center ${
          isActive ? 'text-ink' : 'text-ink-muted'
        }`}>{quantity}</span>
        <button
          type="button"
          onClick={onIncrement}
          aria-label={`Agregar uno de ${combo.name}`}
          className="h-7 w-7 rounded-full bg-brand text-white text-base font-bold flex items-center justify-center"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export default memo(ComboRow);
