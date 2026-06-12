'use client';

import { Loader2 } from 'lucide-react';
import type { CartItem } from '@/lib/combos';
import { getComboById } from '@/lib/combos';
import type { BuyerData } from './UnifiedBuyerForm';

interface UnifiedReviewProps {
  raffleNumbers: number[];
  pricePerNumber: number;
  combos: CartItem[];
  buyer: BuyerData;
  total: number;
  onConfirm: () => void;
  onBack: () => void;
  isConfirming: boolean;
  raffleTitle: string;
}

export default function UnifiedReview(props: UnifiedReviewProps) {
  const raffleSubtotal = props.pricePerNumber * props.raffleNumbers.length;
  const combosSubtotal = props.combos.reduce(
    (s, it) => s + (getComboById(it.comboId)?.price ?? 0) * it.quantity,
    0,
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-extrabold tracking-tight">Revisá tu compra</h2>

      {props.raffleNumbers.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-ink-soft mb-2">🎟️ {props.raffleTitle}</h3>
          <div className="bg-surface-raised rounded-card p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {props.raffleNumbers.map((n) => (
                <span key={n} className="bg-accent/10 text-accent rounded px-2 py-1 text-sm font-bold">
                  #{String(n).padStart(4, '0')}
                </span>
              ))}
            </div>
            <div className="flex justify-between text-sm">
              <span>
                {props.raffleNumbers.length} {props.raffleNumbers.length === 1 ? 'número' : 'números'} × ${props.pricePerNumber.toLocaleString('es-AR')}
              </span>
              <span className="font-semibold">${raffleSubtotal.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </section>
      )}

      {props.combos.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-ink-soft mb-2">🥪 Combos del evento</h3>
          <div className="bg-surface-raised rounded-card p-4 space-y-2">
            {props.combos.map((it) => {
              const c = getComboById(it.comboId);
              if (!c) return null;
              const flavorLine = it.flavors
                ? [
                    it.flavors.carne ? `${it.flavors.carne} carne` : null,
                    it.flavors.jyq ? `${it.flavors.jyq} jamón y queso` : null,
                  ].filter(Boolean).join(' · ')
                : null;
              return (
                <div key={it.comboId} className="flex justify-between text-sm">
                  <div>
                    <div>{c.name} × {it.quantity}</div>
                    {flavorLine && <div className="text-xs text-ink-soft mt-0.5">{flavorLine}</div>}
                  </div>
                  <span className="font-semibold">${(c.price * it.quantity).toLocaleString('es-AR')}</span>
                </div>
              );
            })}
            <div className="border-t border-line pt-2 flex justify-between font-semibold">
              <span>Subtotal combos</span>
              <span>${combosSubtotal.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs uppercase tracking-wider text-ink-soft mb-2">Datos del comprador</h3>
        <div className="bg-surface-raised rounded-card p-4 space-y-1 text-sm">
          <div><span className="text-ink-soft">Nombre:</span> <strong>{props.buyer.name}</strong></div>
          <div><span className="text-ink-soft">Email:</span> <strong>{props.buyer.email}</strong></div>
          <div><span className="text-ink-soft">Tel:</span> <strong>{props.buyer.phone}</strong></div>
          {props.buyer.studentName && (
            <div>
              <span className="text-ink-soft">Alumno:</span>{' '}
              <strong>{props.buyer.studentName} — {props.buyer.course} {props.buyer.division}</strong>
            </div>
          )}
        </div>
      </section>

      <div className="bg-ink text-white rounded-card p-4 flex justify-between items-center">
        <span className="text-sm">Total a pagar</span>
        <span className="text-2xl font-extrabold text-accent">${props.total.toLocaleString('es-AR')}</span>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={props.onConfirm}
          disabled={props.isConfirming}
          className="w-full bg-brand text-white rounded-ctl py-3 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {props.isConfirming
            ? <><Loader2 className="animate-spin" size={18} /> Redirigiendo a MercadoPago...</>
            : 'Pagar con MercadoPago'}
        </button>
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.isConfirming}
          className="w-full bg-surface-raised text-ink rounded-ctl py-3 font-semibold"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
