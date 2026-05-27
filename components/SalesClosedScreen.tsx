import PageContainer from './layout/PageContainer';

export default function SalesClosedScreen() {
  return (
    <PageContainer>
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-surface-raised rounded-2xl shadow-sm border border-ink-muted/10 p-8 text-center">
          <div className="text-5xl mb-4" aria-hidden="true">🎟️</div>
          <h1 className="text-2xl font-bold text-ink mb-3">
            ¡Gracias por participar!
          </h1>
          <p className="text-ink-muted text-base mb-6 leading-relaxed">
            Las ventas de la rifa están cerradas.
          </p>
          <div className="bg-brand/5 border border-brand/20 rounded-xl px-4 py-3 text-sm text-brand font-medium">
            El sorteo es el <strong>29/05/2026</strong>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
