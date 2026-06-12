'use client';

import { CheckCircle, Share2 } from 'lucide-react';
import type { CartItem } from '@/lib/combos';
import { getComboById } from '@/lib/combos';

interface OrderSuccessScreenProps {
  orderId: string;
  raffleNumbers?: number[];
  combos?: CartItem[];
  total?: number;
  onRestart: () => void;
}

export default function OrderSuccessScreen(props: OrderSuccessScreenProps) {
  const handleShare = () => {
    const parts: string[] = [];
    if (props.raffleNumbers && props.raffleNumbers.length > 0) {
      parts.push(
        `Compré ${props.raffleNumbers.length} ${props.raffleNumbers.length === 1 ? 'número' : 'números'} de la rifa: ${props.raffleNumbers.join(', ')}`,
      );
    }
    if (props.combos && props.combos.length > 0) {
      const comboLines = props.combos
        .map((it) => {
          const c = getComboById(it.comboId);
          return c ? `${c.name} × ${it.quantity}` : null;
        })
        .filter(Boolean);
      parts.push(`Y combos: ${comboLines.join(', ')}`);
    }
    parts.push(`Mi código de orden: ${props.orderId}`);
    const text = parts.join('. ');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="text-center space-y-5 py-8">
      <CheckCircle size={64} className="text-state-available-fg mx-auto" />
      <h2 className="text-2xl font-extrabold tracking-tight">¡Compra exitosa!</h2>
      <p className="text-ink-soft text-sm">Te enviamos el comprobante por email.</p>

      <div className="bg-accent/10 rounded-card p-5 inline-block">
        <div className="text-xs uppercase tracking-wider text-ink-soft mb-1">Código de orden</div>
        <div className="text-2xl font-extrabold tracking-wide">{props.orderId}</div>
      </div>

      {props.raffleNumbers && props.raffleNumbers.length > 0 && (
        <div className="bg-surface-raised rounded-card p-4">
          <div className="text-xs uppercase tracking-wider text-ink-soft mb-2">Números asignados</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {props.raffleNumbers.map((n) => (
              <span key={n} className="bg-brand text-white rounded px-3 py-1 font-bold">
                #{String(n).padStart(4, '0')}
              </span>
            ))}
          </div>
        </div>
      )}

      {props.combos && props.combos.length > 0 && (
        <div className="bg-surface-raised rounded-card p-4 text-left">
          <div className="text-xs uppercase tracking-wider text-ink-soft mb-2">Combos pedidos</div>
          <ul className="space-y-1 text-sm">
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
                <li key={it.comboId}>
                  · {c.name} × {it.quantity}
                  {flavorLine && <span className="text-ink-soft"> ({flavorLine})</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {props.total && (
        <div className="text-sm">
          <span className="text-ink-soft">Total pagado: </span>
          <strong className="text-accent text-lg">${props.total.toLocaleString('es-AR')}</strong>
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={handleShare}
          className="w-full bg-state-available-fg text-white rounded-ctl py-3 font-semibold flex items-center justify-center gap-2"
        >
          <Share2 size={18} /> Compartir por WhatsApp
        </button>
        <button
          type="button"
          onClick={props.onRestart}
          className="w-full bg-surface-raised text-ink rounded-ctl py-3 font-semibold"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
