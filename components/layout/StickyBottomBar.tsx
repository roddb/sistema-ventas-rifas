import { ReactNode } from 'react';

interface StickyBottomBarProps {
  children: ReactNode;
  /** Mostrar borde superior. Default true. Útil ponerlo false si la barra va sobre fondo brand. */
  withBorder?: boolean;
  className?: string;
}

export default function StickyBottomBar({ children, withBorder = true, className = '' }: StickyBottomBarProps) {
  return (
    <div
      className={`
        sticky bottom-0 z-20
        bg-surface-raised
        ${withBorder ? 'border-t border-line' : ''}
        px-4 py-3
        ${className}
      `}
    >
      {children}
    </div>
  );
}
