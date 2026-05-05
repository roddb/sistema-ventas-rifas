import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import type { FormData } from '../RifasApp';

interface PurchaseReviewProps {
  selectedNumber: number;
  pricePerNumber: number;
  formData: FormData;
  isPaying: boolean;
  errorMessage: string | null;
  onPay: () => void;
  onBack: () => void;
}

interface RowProps {
  label: string;
  value: string;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="flex justify-between py-2 border-b border-line text-xs last:border-b-0">
      <span className="text-ink-soft">{label}</span>
      <span className="text-ink font-semibold text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}

export default function PurchaseReview({
  selectedNumber,
  pricePerNumber,
  formData,
  isPaying,
  errorMessage,
  onPay,
  onBack,
}: PurchaseReviewProps) {
  const formattedTotal = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(pricePerNumber);

  const studentLine = `${formData.studentName} · ${formData.course}°${formData.division}`;

  return (
    <>
      <AppHeader variant="wizard" title="Revisá tu compra" meta="3 / 4" onBack={onBack} />

      <div className="flex-1 px-4 py-5 flex flex-col gap-3 overflow-y-auto">
        <h2 className="text-lg font-bold text-ink tracking-tight-1">Última revisión</h2>

        <div className="bg-surface-raised border border-line rounded-card p-3 shadow-card">
          <div className="text-[10px] font-semibold text-ink-muted uppercase tracking-[0.05em] mb-2">
            Tu número
          </div>
          <span className="bg-brand-tint text-brand text-2xl font-extrabold tracking-tight-2 px-3 py-1.5 rounded-chip inline-block">
            {selectedNumber}
          </span>
        </div>

        <div className="bg-surface-raised border border-line rounded-card px-3 py-2 shadow-card">
          <Row label="Comprador" value={formData.buyerName} />
          <Row label="Email" value={formData.email} />
          <Row label="Estudiante" value={studentLine} />
          <Row label="Total" value={formattedTotal} />
        </div>

        <div className="bg-state-warning-bg border border-state-warning-border text-state-warning-fg rounded-banner px-3 py-2 text-[11px] leading-relaxed">
          ⏱ Tu número queda reservado <strong>15 minutos</strong>. Si no completás el pago, vuelve a estar disponible.
        </div>

        {errorMessage && (
          <div className="bg-state-sold/10 border border-state-sold text-state-sold rounded-banner px-3 py-2 text-xs">
            {errorMessage}
          </div>
        )}
      </div>

      <StickyBottomBar>
        <button
          type="button"
          disabled={isPaying}
          onClick={onPay}
          className="w-full bg-mp-blue text-white text-sm font-semibold py-2.5 rounded-ctl hover:opacity-90 disabled:bg-ink-muted disabled:cursor-not-allowed transition-opacity"
        >
          {isPaying ? 'Redirigiendo…' : 'Pagar con MercadoPago →'}
        </button>
        <p className="text-[10px] text-ink-muted text-center mt-1.5">
          🔒 Pago seguro · MercadoPago
        </p>
      </StickyBottomBar>
    </>
  );
}
