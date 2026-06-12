'use client';

interface CrossSellSheetProps {
  open: boolean;
  onClose: () => void;
  productSold: 'rifa' | 'combo';
  onAccept: () => void;
  onDecline: () => void;
}

export default function CrossSellSheet({ open, onClose, productSold, onAccept, onDecline }: CrossSellSheetProps) {
  if (!open) return null;

  const otherProduct = productSold === 'rifa' ? 'el combo de empanadas' : 'números de la rifa';
  const otherEmoji = productSold === 'rifa' ? '🥟' : '🎟️';
  const otherCta = productSold === 'rifa' ? 'Sí, ver combo' : 'Sí, ver rifa';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl">
        <div className="max-w-[560px] mx-auto px-5 py-7 text-center">
          <div className="text-5xl mb-3" aria-hidden="true">{otherEmoji}</div>
          <h2 className="text-xl font-extrabold tracking-tight mb-2">¿Querés sumar {otherProduct}?</h2>
          <p className="text-sm text-ink-soft mb-6">
            Sumalos a esta misma compra y pagás todo en una sola operación.
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={onAccept}
              className="w-full bg-brand text-white rounded-ctl py-3 font-semibold"
            >
              {otherCta}
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="w-full bg-surface-raised text-ink rounded-ctl py-3 font-semibold"
            >
              No, seguir al pago
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
