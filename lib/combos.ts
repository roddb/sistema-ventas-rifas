// Sede 2 (rifa escolar 2026): un único combo de empanadas.
// El comprador elige N combos → N × EMPANADAS_PER_COMBO empanadas, que reparte
// exactamente entre los gustos de EMPANADA_FLAVORS (carne / jamón y queso).
export const COMBOS = [
  { id: 'empanadas', name: 'Combo de empanadas', description: '2 empanadas + vaso de gaseosa', price: 12000, emoji: '🥟' },
] as const;

export const EMPANADAS_PER_COMBO = 2;

export const EMPANADA_FLAVORS = [
  { id: 'carne', name: 'Carne' },
  { id: 'jyq', name: 'Jamón y queso' },
] as const;

export type FlavorId = typeof EMPANADA_FLAVORS[number]['id'];

export interface FlavorBreakdown {
  carne: number;
  jyq: number;
}

export type ComboId = typeof COMBOS[number]['id'];

export type Combo = typeof COMBOS[number];

export interface CartItem {
  comboId: ComboId | string;
  quantity: number;
  // Desglose de gustos para el combo de empanadas. La suma debe ser quantity * EMPANADAS_PER_COMBO.
  flavors?: FlavorBreakdown;
}

export function getComboById(id: string): Combo | null {
  return COMBOS.find((c) => c.id === id) ?? null;
}

export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const combo = getComboById(item.comboId);
    if (!combo) return sum;
    return sum + combo.price * item.quantity;
  }, 0);
}

// Cuántas empanadas hay que repartir para N combos.
export function empanadasForCombos(comboCount: number): number {
  return comboCount * EMPANADAS_PER_COMBO;
}

// La asignación de gustos es válida sólo si suma EXACTAMENTE N × EMPANADAS_PER_COMBO.
export function isFlavorBreakdownValid(comboCount: number, flavors: FlavorBreakdown): boolean {
  if (comboCount <= 0) return false;
  if (flavors.carne < 0 || flavors.jyq < 0) return false;
  if (!Number.isInteger(flavors.carne) || !Number.isInteger(flavors.jyq)) return false;
  return flavors.carne + flavors.jyq === empanadasForCombos(comboCount);
}
