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
          <p className="text-ink-muted text-base leading-relaxed">
            Las ventas de la rifa están cerradas.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
