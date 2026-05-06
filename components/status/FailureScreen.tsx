import { AlertCircle } from 'lucide-react';
import AppHeader from '../layout/AppHeader';

interface FailureScreenProps {
  number: number | null;
  onRestart: () => void;
  /** Contexto del producto para ajustar el copy. Default 'rifa' (sin breaking change). */
  productType?: 'rifa' | 'combo' | 'order';
}

export default function FailureScreen({ number, onRestart, productType = 'rifa' }: FailureScreenProps) {
  const isCombo = productType === 'combo';
  const isOrder = productType === 'order';

  return (
    <>
      <AppHeader variant="hero" meta="2026" />

      <div className="flex-1 px-4 py-8 flex flex-col items-center text-center gap-3">
        <div
          className="w-16 h-16 bg-state-sold/10 rounded-full flex items-center justify-center"
          aria-hidden="true"
        >
          <AlertCircle className="w-8 h-8 text-state-sold" />
        </div>

        <h1 className="text-2xl font-extrabold text-ink tracking-tight-2 leading-tight">
          {isOrder ? 'Hubo un problema con tu compra' : 'Hubo un problema con el pago'}
        </h1>
        <p className="text-sm text-ink-soft">
          MercadoPago no pudo procesar tu pago.{' '}
          {!isCombo && !isOrder && number !== null && (
            <>
              Tu número <strong>{number}</strong> sigue disponible si querés intentar de nuevo en los próximos 15 minutos.
            </>
          )}
          {isCombo && (
            <>
              Tu pedido de combos sigue disponible si querés intentar de nuevo.
            </>
          )}
          {isOrder && (
            <>
              Podés volver al inicio e intentar de nuevo.
            </>
          )}
        </p>

        <button
          type="button"
          onClick={onRestart}
          className="w-full bg-brand text-white py-2.5 rounded-ctl text-sm font-semibold mt-3 hover:bg-brand/90 transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    </>
  );
}
