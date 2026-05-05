import { Check, MessageCircle } from 'lucide-react';
import AppHeader from '../layout/AppHeader';

interface SuccessScreenProps {
  number?: number;
  email: string;
  raffleTitle: string;
  onShareWhatsApp: () => void;
  onRestart: () => void;
}

function pad4(n: number) {
  return String(n).padStart(4, '0');
}

export default function SuccessScreen({
  number,
  email,
  raffleTitle,
  onShareWhatsApp,
  onRestart,
}: SuccessScreenProps) {
  return (
    <>
      <AppHeader variant="hero" meta="2026" />

      <div className="flex-1 px-4 py-8 flex flex-col items-center text-center gap-3">
        <div
          className="w-16 h-16 bg-state-available-bg rounded-full flex items-center justify-center"
          aria-hidden="true"
        >
          <Check className="w-8 h-8 text-state-available-fg" />
        </div>

        <h1 className="text-3xl font-extrabold text-ink tracking-tight-2 leading-tight">
          ¡Tu número es tuyo!
        </h1>
        <p className="text-sm text-ink-soft">
          El pago se confirmó. Te mandamos el comprobante a <strong>{email}</strong>.
        </p>

        {number !== undefined ? (
          <div className="mt-4 bg-surface-raised border-2 border-accent rounded-card-lg p-5 w-full">
            <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.05em]">
              Tu número
            </div>
            <div className="text-6xl font-black text-brand tracking-tight-4 leading-none">
              {pad4(number)}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">{raffleTitle} · Sorteo: a definir</div>
          </div>
        ) : (
          <div className="mt-4 bg-brand-tint rounded-card-lg p-4 w-full text-sm text-ink-soft">
            Revisá tu correo para ver el número que te quedó asignado en {raffleTitle}.
          </div>
        )}

        {number !== undefined && (
          <button
            type="button"
            onClick={onShareWhatsApp}
            className="w-full bg-surface-raised text-brand border-[1.5px] border-brand rounded-ctl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-brand-tint transition-colors mt-2"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            Compartir por WhatsApp
          </button>
        )}

        <button
          type="button"
          onClick={onRestart}
          className="text-xs text-ink-muted underline mt-1"
        >
          ¿Querés otro número? Volver al inicio →
        </button>
      </div>
    </>
  );
}
