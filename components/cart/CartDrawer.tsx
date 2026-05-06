'use client';

import { X, Minus, Plus, Trash2 } from 'lucide-react';
import type { CartItem } from '@/lib/combos';
import { getComboById } from '@/lib/combos';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  raffleNumbers: number[];
  combos: CartItem[];
  pricePerNumber: number;
  total: number;
  onRemoveNumber: (number: number) => void;
  onComboQuantityChange: (comboId: string, delta: number) => void;
  onRemoveCombo: (comboId: string) => void;
}

export default function CartDrawer(props: CartDrawerProps) {
  if (!props.open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={props.onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <div className="max-w-[560px] mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold tracking-tight">Tu compra</h2>
            <button onClick={props.onClose} aria-label="Cerrar">
              <X size={24} />
            </button>
          </div>

          {props.raffleNumbers.length > 0 && (
            <section className="mb-4">
              <h3 className="text-xs uppercase tracking-wider text-ink-soft mb-2">🎟️ Números rifa</h3>
              <ul className="space-y-2">
                {props.raffleNumbers.map((n) => (
                  <li key={n} className="flex items-center justify-between bg-surface-raised rounded-ctl px-3 py-2">
                    <span className="font-semibold">#{String(n).padStart(4, '0')}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-ink-soft">${props.pricePerNumber.toLocaleString('es-AR')}</span>
                      <button onClick={() => props.onRemoveNumber(n)} aria-label={`Quitar número ${n}`}>
                        <Trash2 size={18} className="text-state-sold" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {props.combos.length > 0 && (
            <section className="mb-4">
              <h3 className="text-xs uppercase tracking-wider text-ink-soft mb-2">🥪 Combos</h3>
              <ul className="space-y-2">
                {props.combos.map((it) => {
                  const combo = getComboById(it.comboId);
                  if (!combo) return null;
                  return (
                    <li key={it.comboId} className="flex items-center justify-between bg-surface-raised rounded-ctl px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{combo.name}</div>
                        <div className="text-xs text-ink-soft">${combo.price.toLocaleString('es-AR')} c/u</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => props.onComboQuantityChange(it.comboId, -1)}
                          className="bg-surface w-8 h-8 rounded flex items-center justify-center"
                          disabled={it.quantity <= 1}
                          aria-label="Restar"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-6 text-center font-semibold">{it.quantity}</span>
                        <button
                          onClick={() => props.onComboQuantityChange(it.comboId, +1)}
                          className="bg-surface w-8 h-8 rounded flex items-center justify-center"
                          aria-label="Sumar"
                        >
                          <Plus size={16} />
                        </button>
                        <button onClick={() => props.onRemoveCombo(it.comboId)} aria-label={`Quitar ${combo.name}`}>
                          <Trash2 size={18} className="text-state-sold ml-2" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="flex items-center justify-between border-t border-line pt-4 mb-4">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-extrabold text-accent">${props.total.toLocaleString('es-AR')}</span>
          </div>

          <button
            onClick={props.onClose}
            className="w-full bg-brand text-white rounded-ctl py-3 font-semibold"
          >
            Cerrar carrito
          </button>
        </div>
      </div>
    </>
  );
}
