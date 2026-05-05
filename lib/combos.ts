export const COMBOS = [
  { id: 'chorizo',   name: 'Sandwich de chorizo', description: '+ vaso de gaseosa', price: 15000, emoji: '🥪' },
  { id: 'carne',     name: 'Sandwich de carne',   description: '+ vaso de gaseosa', price: 15000, emoji: '🍖' },
  { id: 'empanadas', name: '3 empanadas',         description: '+ vaso de gaseosa', price: 15000, emoji: '🥟' },
] as const;

export type ComboId = typeof COMBOS[number]['id'];

export type Combo = typeof COMBOS[number];

export interface CartItem {
  comboId: ComboId | string;
  quantity: number;
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
