'use client';

import { Minus, Plus } from 'lucide-react';
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import {
  COMBOS,
  EMPANADA_FLAVORS,
  empanadasForCombos,
  type FlavorBreakdown,
  type FlavorId,
} from '../../lib/combos';

interface ComboCatalogProps {
  comboCount: number;
  flavors: FlavorBreakdown;
  onChangeCombo: (delta: number) => void;
  onChangeFlavor: (flavorId: FlavorId, delta: number) => void;
  onContinue: () => void;
  onBack: () => void;
}

const COMBO = COMBOS[0]; // único combo de la sede 2: empanadas

export default function ComboCatalog({
  comboCount,
  flavors,
  onChangeCombo,
  onChangeFlavor,
  onContinue,
  onBack,
}: ComboCatalogProps) {
  const totalEmpanadas = empanadasForCombos(comboCount);
  const assigned = flavors.carne + flavors.jyq;
  const remaining = totalEmpanadas - assigned;
  const total = COMBO.price * comboCount;
  const flavorsComplete = comboCount > 0 && remaining === 0;
  const canContinue = comboCount > 0 && flavorsComplete;

  return (
    <>
      <AppHeader variant="wizard" onBack={onBack} title="Combo de empanadas" />
      <main className="px-5 pt-4 pb-32 flex flex-col gap-4">
        {/* Card del combo */}
        <div className="rounded-xl border border-line bg-surface-raised p-4 flex items-center gap-3">
          <div className="text-4xl leading-none flex-shrink-0" aria-hidden>{COMBO.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-ink leading-tight">{COMBO.name}</div>
            <div className="text-xs text-ink-muted mt-0.5">{COMBO.description}</div>
            <div className="text-base font-extrabold text-brand mt-1">
              ${COMBO.price.toLocaleString('es-AR')}
            </div>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full p-0.5 px-1 border ${
              comboCount > 0 ? 'border-brand' : 'border-line'
            }`}
            role="group"
            aria-label="Cantidad de combos"
          >
            <button
              type="button"
              onClick={() => onChangeCombo(-1)}
              disabled={comboCount === 0}
              aria-label="Quitar un combo"
              className={`h-8 w-8 rounded-full text-base font-bold transition flex items-center justify-center ${
                comboCount === 0 ? 'text-ink-muted cursor-not-allowed' : 'text-brand'
              }`}
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span className={`text-base font-extrabold min-w-[18px] text-center ${
              comboCount > 0 ? 'text-ink' : 'text-ink-muted'
            }`}>{comboCount}</span>
            <button
              type="button"
              onClick={() => onChangeCombo(+1)}
              aria-label="Agregar un combo"
              className="h-8 w-8 rounded-full bg-brand text-white text-base font-bold flex items-center justify-center"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* Selección de gustos — aparece cuando hay al menos 1 combo */}
        {comboCount > 0 && (
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-sm font-bold text-ink">Elegí los gustos</h3>
              <span className={`text-xs font-bold ${flavorsComplete ? 'text-state-available' : 'text-accent'}`}>
                {assigned} / {totalEmpanadas}
              </span>
            </div>
            <p className="text-xs text-ink-muted mb-3">
              {flavorsComplete
                ? '¡Listo! Repartiste todas las empanadas.'
                : `Repartí ${totalEmpanadas} ${totalEmpanadas === 1 ? 'empanada' : 'empanadas'} entre los gustos (te ${remaining === 1 ? 'falta' : 'faltan'} ${remaining}).`}
            </p>
            <div className="flex flex-col gap-2.5">
              {EMPANADA_FLAVORS.map((flavor) => {
                const value = flavors[flavor.id];
                const atMax = remaining === 0;
                return (
                  <div key={flavor.id} className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2">
                    <span className="text-sm font-semibold text-ink">{flavor.name}</span>
                    <div
                      className="flex items-center gap-2 rounded-full p-0.5 px-1 border border-line"
                      role="group"
                      aria-label={`Empanadas de ${flavor.name}`}
                    >
                      <button
                        type="button"
                        onClick={() => onChangeFlavor(flavor.id, -1)}
                        disabled={value === 0}
                        aria-label={`Quitar una empanada de ${flavor.name}`}
                        className={`h-7 w-7 rounded-full text-base font-bold transition flex items-center justify-center ${
                          value === 0 ? 'text-ink-muted cursor-not-allowed' : 'text-brand'
                        }`}
                      >
                        <Minus className="h-4 w-4" aria-hidden />
                      </button>
                      <span className="text-sm font-extrabold min-w-[16px] text-center text-ink">{value}</span>
                      <button
                        type="button"
                        onClick={() => onChangeFlavor(flavor.id, +1)}
                        disabled={atMax}
                        aria-label={`Agregar una empanada de ${flavor.name}`}
                        className={`h-7 w-7 rounded-full text-base font-bold flex items-center justify-center ${
                          atMax ? 'bg-ink-muted/40 text-white cursor-not-allowed' : 'bg-brand text-white'
                        }`}
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <StickyBottomBar>
        <div className="flex items-center justify-between w-full">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-muted">
              Total · {comboCount} {comboCount === 1 ? 'combo' : 'combos'}
            </div>
            <div className="text-lg font-black text-ink">${total.toLocaleString('es-AR')}</div>
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className={`rounded-lg px-5 py-3 text-sm font-bold transition ${
              canContinue ? 'bg-brand text-white' : 'bg-ink-muted text-white cursor-not-allowed opacity-60'
            }`}
          >
            Continuar →
          </button>
        </div>
      </StickyBottomBar>
    </>
  );
}
