import { useEffect, useRef } from 'react';

interface RangeTabsProps {
  totalNumbers: number;
  rangeSize: number;
  activeRangeIndex: number;
  onSelect: (index: number) => void;
}

export default function RangeTabs({
  totalNumbers,
  rangeSize,
  activeRangeIndex,
  onSelect,
}: RangeTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const rangeCount = Math.ceil(totalNumbers / rangeSize);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const tab = activeRef.current;
      const container = containerRef.current;
      const tabLeft = tab.offsetLeft;
      const tabRight = tabLeft + tab.offsetWidth;
      const visibleLeft = container.scrollLeft;
      const visibleRight = visibleLeft + container.clientWidth;
      if (tabLeft < visibleLeft || tabRight > visibleRight) {
        container.scrollTo({ left: tabLeft - 16, behavior: 'smooth' });
      }
    }
  }, [activeRangeIndex]);

  return (
    <div className="bg-surface px-3 py-2 border-b border-line">
      <div ref={containerRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {Array.from({ length: rangeCount }, (_, i) => {
          const start = i * rangeSize + 1;
          const end = Math.min(start + rangeSize - 1, totalNumbers);
          const isActive = i === activeRangeIndex;
          return (
            <button
              key={i}
              ref={isActive ? activeRef : null}
              type="button"
              onClick={() => onSelect(i)}
              className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-chip transition-colors ${
                isActive
                  ? 'bg-brand text-white'
                  : 'bg-surface-raised text-ink-soft border border-line hover:border-brand'
              }`}
              aria-pressed={isActive}
            >
              {start}-{end}
            </button>
          );
        })}
      </div>
    </div>
  );
}
