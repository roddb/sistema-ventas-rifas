import { memo } from 'react';

export type NumberStatus = 'available' | 'reserved' | 'sold' | 'selected';

interface NumberCellProps {
  number: number;
  status: NumberStatus;
  onClick: (n: number) => void;
}

const STATUS_CLASSES: Record<NumberStatus, string> = {
  available: 'bg-state-available-bg text-state-available-fg hover:bg-state-available-bg/80 cursor-pointer',
  reserved: 'bg-state-reserved-bg text-state-reserved-fg cursor-not-allowed opacity-80',
  sold: 'bg-state-sold text-white cursor-not-allowed opacity-90',
  selected: 'bg-accent text-white font-bold ring-2 ring-accent-strong cursor-pointer',
};

function NumberCellInner({ number, status, onClick }: NumberCellProps) {
  const isInteractive = status === 'available' || status === 'selected';
  return (
    <button
      type="button"
      disabled={!isInteractive}
      onClick={isInteractive ? () => onClick(number) : undefined}
      className={`aspect-square rounded-chip flex items-center justify-center text-[11px] font-semibold transition-colors ${STATUS_CLASSES[status]}`}
      aria-label={`Número ${number}, ${status}`}
    >
      {number}
    </button>
  );
}

export default memo(NumberCellInner);
