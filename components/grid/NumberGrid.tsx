import { useMemo, useState } from 'react';
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import GridLegend from './GridLegend';
import NumberCell, { NumberStatus } from './NumberCell';
import NumberSearch from './NumberSearch';
import RangeTabs from './RangeTabs';
import type { RaffleNumber } from '../RifasApp';

const RANGE_SIZE = 100;

interface NumberGridProps {
  numbers: RaffleNumber[];
  totalNumbers: number;
  selectedNumber: number | null;
  pricePerNumber: number;
  onSelect: (n: number | null) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function NumberGrid({
  numbers,
  totalNumbers,
  selectedNumber,
  pricePerNumber,
  onSelect,
  onContinue,
  onBack,
}: NumberGridProps) {
  const [activeRangeIndex, setActiveRangeIndex] = useState(0);

  // Index status by number for O(1) lookup
  const statusByNumber = useMemo(() => {
    const map = new Map<number, NumberStatus>();
    numbers.forEach((n) => map.set(n.number, n.status));
    return map;
  }, [numbers]);

  const rangeStart = activeRangeIndex * RANGE_SIZE + 1;
  const rangeEnd = Math.min(rangeStart + RANGE_SIZE - 1, totalNumbers);
  const rangeNumbers = useMemo(() => {
    const arr: number[] = [];
    for (let n = rangeStart; n <= rangeEnd; n++) arr.push(n);
    return arr;
  }, [rangeStart, rangeEnd]);

  const formattedPrice = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(pricePerNumber);

  const handleSearch = (n: number) => {
    const idx = Math.floor((n - 1) / RANGE_SIZE);
    setActiveRangeIndex(idx);
    const status = statusByNumber.get(n);
    if (status === 'available') {
      onSelect(n);
    }
  };

  const handleCellClick = (n: number) => {
    if (selectedNumber === n) {
      onSelect(null);
    } else {
      onSelect(n);
    }
  };

  return (
    <>
      <AppHeader
        variant="wizard"
        title="Elegí tu número"
        meta={selectedNumber ? '1 sel.' : '0 sel.'}
        onBack={onBack}
      />

      <NumberSearch totalNumbers={totalNumbers} onFound={handleSearch} />
      <RangeTabs
        totalNumbers={totalNumbers}
        rangeSize={RANGE_SIZE}
        activeRangeIndex={activeRangeIndex}
        onSelect={setActiveRangeIndex}
      />

      <div className="flex-1 px-3 py-3 flex flex-col gap-3 overflow-y-auto">
        <GridLegend />
        <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
          {rangeNumbers.map((n) => {
            const baseStatus = statusByNumber.get(n) ?? 'available';
            const status: NumberStatus = selectedNumber === n ? 'selected' : baseStatus;
            return (
              <NumberCell
                key={n}
                number={n}
                status={status}
                onClick={handleCellClick}
              />
            );
          })}
        </div>
      </div>

      <StickyBottomBar>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-ink-muted">
            {selectedNumber ? `1 número · ${formattedPrice}` : 'Sin selección'}
          </div>
          {selectedNumber && (
            <span className="bg-brand-tint text-brand text-[11px] font-bold px-2 py-1 rounded-chip">
              {selectedNumber}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={!selectedNumber}
          onClick={onContinue}
          className="w-full bg-brand text-white text-sm font-semibold py-2.5 rounded-ctl hover:bg-brand/90 disabled:bg-ink-muted disabled:cursor-not-allowed transition-colors"
        >
          Continuar →
        </button>
      </StickyBottomBar>
    </>
  );
}
