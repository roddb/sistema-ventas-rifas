'use client';

import { useState } from 'react';
import ComboCatalog from './ComboCatalog';
import ComboBuyerForm, { type ComboBuyer } from './ComboBuyerForm';
import ComboReview from './ComboReview';
import ComboSuccessScreen from '../status/ComboSuccessScreen';
import FailureScreen from '../status/FailureScreen';
import PendingScreen from '../status/PendingScreen';
import { calculateTotal, type CartItem } from '../../lib/combos';

type ComboStep = 'catalog' | 'form' | 'review' | 'success' | 'failure' | 'pending';

interface ComboFlowProps {
  onExit: () => void;
  initialStep?: ComboStep;
  initialOrderCode?: string | null;
}

export default function ComboFlow({
  onExit,
  initialStep = 'catalog',
  initialOrderCode = null,
}: ComboFlowProps) {
  const [step, setStep] = useState<ComboStep>(initialStep);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState<ComboBuyer | null>(null);
  const [comboPurchaseId, setComboPurchaseId] = useState<string | null>(initialOrderCode);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeQuantity(comboId: string, delta: number): void {
    setCart((prev) => {
      const current = prev[comboId] ?? 0;
      const next = Math.max(0, Math.min(50, current + delta));
      const updated = { ...prev };
      if (next === 0) delete updated[comboId];
      else updated[comboId] = next;
      return updated;
    });
  }

  const cartItems: CartItem[] = Object.entries(cart).map(([comboId, quantity]) => ({
    comboId,
    quantity,
  }));
  const total = calculateTotal(cartItems);

  async function handleConfirm(): Promise<void> {
    if (!buyer) return;
    setIsLoading(true);
    setError(null);

    try {
      const purchaseRes = await fetch('/api/combo/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyer, items: cartItems }),
      });
      const purchaseData = (await purchaseRes.json()) as { success?: boolean; error?: string; comboPurchaseId?: string };
      if (!purchaseRes.ok || !purchaseData.success) {
        throw new Error(purchaseData.error ?? 'Error al crear compra');
      }
      const id = purchaseData.comboPurchaseId as string;
      setComboPurchaseId(id);

      const prefRes = await fetch('/api/combo/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comboPurchaseId: id }),
      });
      const prefData = (await prefRes.json()) as { success?: boolean; error?: string; initPoint?: string };
      if (!prefRes.ok || !prefData.success || !prefData.initPoint) {
        throw new Error(prefData.error ?? 'Error al crear preferencia');
      }

      window.location.href = prefData.initPoint;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setIsLoading(false);
    }
  }

  function restart(): void {
    setCart({});
    setBuyer(null);
    setComboPurchaseId(null);
    setError(null);
    onExit();
  }

  if (step === 'success') {
    return (
      <ComboSuccessScreen
        orderCode={comboPurchaseId}
        cart={cart}
        onRestart={restart}
      />
    );
  }

  if (step === 'failure') {
    return (
      <FailureScreen
        number={null}
        productType="combo"
        onRestart={restart}
      />
    );
  }

  if (step === 'pending') {
    return (
      <PendingScreen
        productType="combo"
        onRestart={restart}
      />
    );
  }

  if (step === 'catalog') {
    return (
      <ComboCatalog
        cart={cart}
        onChangeQuantity={changeQuantity}
        onContinue={() => {
          if (Object.keys(cart).length === 0) return;
          setStep('form');
        }}
        onBack={onExit}
      />
    );
  }

  if (step === 'form') {
    return (
      <ComboBuyerForm
        initial={buyer ?? undefined}
        onSubmit={(b) => {
          setBuyer(b);
          setStep('review');
        }}
        onBack={() => setStep('catalog')}
      />
    );
  }

  // step === 'review'
  if (!buyer) {
    setStep('form');
    return null;
  }

  return (
    <ComboReview
      cart={cart}
      buyer={buyer}
      total={total}
      isLoading={isLoading}
      error={error}
      onConfirm={() => { void handleConfirm(); }}
      onBack={() => setStep('form')}
    />
  );
}
