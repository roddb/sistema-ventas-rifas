'use client';

import { ChevronUp } from 'lucide-react';

interface StickyCartBarProps {
  itemCount: number;
  total: number;
  onTap: () => void;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function StickyCartBar({ itemCount, total, onTap, ctaLabel, onCta }: StickyCartBarProps) {
  if (itemCount === 0) return null;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 bg-ink text-white rounded-t-[10px] shadow-lg">
      <div className="max-w-[560px] mx-auto px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onTap}
          className="flex-1 flex items-center justify-between text-left"
          aria-label="Ver carrito"
        >
          <div>
            <div className="text-[11px] opacity-70">Tu compra</div>
            <div className="text-sm font-semibold">{itemCount} {itemCount === 1 ? 'item' : 'items'}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] opacity-70 flex items-center gap-1 justify-end">
              Ver detalle <ChevronUp size={12} />
            </div>
            <div className="text-base font-extrabold text-accent">${total.toLocaleString('es-AR')}</div>
          </div>
        </button>
        {ctaLabel && onCta && (
          <button
            type="button"
            onClick={onCta}
            className="bg-brand text-white rounded-ctl px-4 py-2 text-sm font-semibold whitespace-nowrap"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
