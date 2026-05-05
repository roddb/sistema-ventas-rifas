import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface AppHeaderProps {
  /**
   * Variante de presentación del header.
   * - `hero`: muestra brand + meta. Usado en pantalla 1 (landing) y 5 (success/failure/pending).
   * - `wizard`: muestra back button + title + meta de paso. Usado en pantallas 2-4 (grid/form/review).
   */
  variant: 'hero' | 'wizard';
  /** Título central — solo se renderiza en variant=wizard. */
  title?: string;
  /** Texto del lado derecho — meta como "2 / 4", "1 sel.", "2026". */
  meta?: string;
  /** Callback al back button — solo en variant=wizard. */
  onBack?: () => void;
  /** Slot izquierdo del header en variant=hero — placeholder del logo STA. */
  leftSlot?: ReactNode;
}

export default function AppHeader({ variant, title, meta, onBack, leftSlot }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-brand text-white px-4 py-3 flex items-center justify-between">
      {variant === 'hero' ? (
        <div className="flex items-center gap-2">
          {leftSlot ?? (
            <div
              className="w-6 h-6 bg-white text-brand rounded-full flex items-center justify-center text-[9px] font-extrabold"
              aria-hidden="true"
            >
              STA
            </div>
          )}
          <span className="text-[13px] font-semibold tracking-tight-1">Colegio STA</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 -ml-1 px-1 py-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Volver al paso anterior"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span className="text-[13px] font-semibold tracking-tight-1">{title}</span>
        </button>
      )}

      {meta && <span className="text-[10px] opacity-85">{meta}</span>}
    </header>
  );
}
