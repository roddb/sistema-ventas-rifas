'use client';

import { CheckCircle2, MessageCircle } from 'lucide-react';
import PageContainer from '../layout/PageContainer';
import AppHeader from '../layout/AppHeader';
import { COMBOS } from '../../lib/combos';

interface ComboSuccessScreenProps {
  orderCode?: string | null;
  cart?: Record<string, number>;
  onRestart: () => void;
}

export default function ComboSuccessScreen({ orderCode, cart, onRestart }: ComboSuccessScreenProps) {
  const items = cart
    ? COMBOS
        .map((c) => ({ combo: c, quantity: cart[c.id] ?? 0 }))
        .filter((it) => it.quantity > 0)
    : [];

  const shareWhatsApp = (): void => {
    if (!orderCode) return;
    const itemsText = items.map((it) => `${it.quantity}× ${it.combo.name}`).join(', ');
    const text = `Compré combos para el evento STA 2026! ${itemsText}. Código: ${orderCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <PageContainer>
      <AppHeader variant="hero" />
      <main className="px-5 pt-8 pb-10 flex flex-col items-center gap-5 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-600" aria-hidden />
        <h1 className="text-2xl font-black text-ink tracking-tight">¡Pago aprobado!</h1>

        {orderCode ? (
          <div className="w-full">
            <div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1">Tu código de retiro</div>
            <div className="text-3xl font-black text-brand tracking-tight">{orderCode}</div>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Revisá tu correo para ver el comprobante.</p>
        )}

        {items.length > 0 && (
          <div className="w-full rounded-xl border border-line bg-surface-raised p-3 text-left">
            <div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1">Pedido</div>
            <ul className="text-sm text-ink space-y-1">
              {items.map(({ combo, quantity }) => (
                <li key={combo.id}>
                  <span className="font-bold">{quantity}×</span> {combo.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-sm text-ink-muted leading-relaxed">
          El día del evento, retirá tu pedido en el puesto de comida con tu nombre y este código.
        </p>

        <div className="w-full flex flex-col gap-2 mt-4">
          {orderCode && (
            <button
              type="button"
              onClick={shareWhatsApp}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-line bg-surface-raised text-ink py-3 text-sm font-bold"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Compartir por WhatsApp
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded-lg bg-brand text-white py-3 text-sm font-bold"
          >
            Volver al inicio
          </button>
        </div>
      </main>
    </PageContainer>
  );
}
