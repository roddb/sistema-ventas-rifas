import { Clock } from 'lucide-react';
import AppHeader from '../layout/AppHeader';

interface PendingScreenProps {
  onRestart: () => void;
  /** Contexto del producto para ajustar el copy. Default 'rifa' (sin breaking change). */
  productType?: 'rifa' | 'combo' | 'order';
}

export default function PendingScreen({ onRestart, productType = 'rifa' }: PendingScreenProps) {
  const isCombo = productType === 'combo';
  const isOrder = productType === 'order';

  return (
    <>
      <AppHeader variant="hero" meta="2026" />

      <div className="flex-1 px-4 py-8 flex flex-col items-center text-center gap-3">
        <div
          className="w-16 h-16 bg-accent/15 rounded-full flex items-center justify-center"
          aria-hidden="true"
        >
          <Clock className="w-8 h-8 text-accent" />
        </div>

        <h1 className="text-2xl font-extrabold text-ink tracking-tight-2 leading-tight">
          {isOrder ? 'Tu pago está pendiente de aprobación' : isCombo ? 'Tu pedido está en proceso' : 'Tu pago está en proceso'}
        </h1>
        <p className="text-sm text-ink-soft">
          MercadoPago aún está confirmando tu pago. En cuanto se confirme te llega el comprobante por email. Podés cerrar esta pantalla.
        </p>

        <button
          type="button"
          onClick={onRestart}
          className="w-full bg-surface-raised text-brand border-[1.5px] border-brand py-2.5 rounded-ctl text-sm font-semibold mt-3 hover:bg-brand-tint transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    </>
  );
}
