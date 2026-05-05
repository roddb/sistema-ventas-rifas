interface LegendItemProps {
  colorClass: string;
  label: string;
}

function LegendItem({ colorClass, label }: LegendItemProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
      <span className={`inline-block w-2.5 h-2.5 rounded-[3px] ${colorClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export default function GridLegend() {
  return (
    <div className="flex gap-3 flex-wrap">
      <LegendItem colorClass="bg-state-available-bg" label="Disponible" />
      <LegendItem colorClass="bg-accent" label="Tuyo" />
      <LegendItem colorClass="bg-state-sold" label="Vendido" />
      <LegendItem colorClass="bg-state-reserved-bg" label="Reservado" />
    </div>
  );
}
