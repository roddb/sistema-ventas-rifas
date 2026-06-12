'use client';

import { useState, useEffect } from 'react';
import PageContainer from '../layout/PageContainer';
import AppHeader from '../layout/AppHeader';
import NumberGrid from '../grid/NumberGrid';
import ComboCatalog from '../combos/ComboCatalog';
import StickyCartBar from '../cart/StickyCartBar';
import CartDrawer from '../cart/CartDrawer';
import CrossSellSheet from '../cross-sell/CrossSellSheet';
import UnifiedBuyerForm, { type BuyerData } from './UnifiedBuyerForm';
import UnifiedReview from './UnifiedReview';
import OrderSuccessScreen from './OrderSuccessScreen';
import FailureScreen from '../status/FailureScreen';
import PendingScreen from '../status/PendingScreen';
import type { CartItem, FlavorBreakdown, FlavorId } from '../../lib/combos';
import { calculateTotal, isFlavorBreakdownValid, empanadasForCombos } from '../../lib/combos';
import type { RaffleNumber } from '../RifasApp';

type View = 'rifa-grid' | 'combo-catalog' | 'cross-sell' | 'form' | 'review' | 'success' | 'failure' | 'pending';

interface OrderFlowProps {
  initialEntry: 'rifa' | 'combo';
  raffleConfig: { id: number; title: string; pricePerNumber: number; totalNumbers: number };
  numbers: RaffleNumber[];
  onBack: () => void;
  initialPaymentStatus?: 'success' | 'failure' | 'pending';
  initialOrderId?: string;
  refreshNumbers: () => Promise<void>;
}

export default function OrderFlow(props: OrderFlowProps) {
  const [view, setView] = useState<View>(() => {
    if (props.initialPaymentStatus === 'success') return 'success';
    if (props.initialPaymentStatus === 'failure') return 'failure';
    if (props.initialPaymentStatus === 'pending') return 'pending';
    return props.initialEntry === 'rifa' ? 'rifa-grid' : 'combo-catalog';
  });

  // Raffle numbers (array of number values)
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);

  // Combo de empanadas (único combo de la sede 2): cantidad de combos + reparto de gustos.
  // N combos → N×2 empanadas que se reparten exactamente entre carne y jamón y queso.
  const [comboCount, setComboCount] = useState(0);
  const [empanadaFlavors, setEmpanadaFlavors] = useState<FlavorBreakdown>({ carne: 0, jyq: 0 });

  const [cartOpen, setCartOpen] = useState(false);
  const [crossSellShown, setCrossSellShown] = useState(false);
  const [buyer, setBuyer] = useState<BuyerData>({ name: '', email: '', phone: '' });
  const [orderId, setOrderId] = useState<string | undefined>(props.initialOrderId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived: CartItem[] (un único item de empanadas con su desglose de gustos)
  const selectedCombos: CartItem[] = comboCount > 0
    ? [{ comboId: 'empanadas', quantity: comboCount, flavors: empanadaFlavors }]
    : [];

  const hasRaffle = selectedNumbers.length > 0;
  const hasCombos = selectedCombos.length > 0;
  // Los gustos están completos si no hay combos, o si el reparto suma exactamente N×2.
  const combosComplete = comboCount === 0 || isFlavorBreakdownValid(comboCount, empanadaFlavors);
  const raffleCost = props.raffleConfig.pricePerNumber * selectedNumbers.length;
  const total = raffleCost + calculateTotal(selectedCombos);
  const itemCount = selectedNumbers.length + selectedCombos.reduce((s, it) => s + it.quantity, 0);

  // Cleanup query params on mount if coming from MP redirect
  useEffect(() => {
    if (props.initialPaymentStatus) {
      window.history.replaceState({}, '', '/');
    }
  }, [props.initialPaymentStatus]);

  // === Handlers ===

  const handleContinueFromSelection = () => {
    // No avanzar si el reparto de gustos de empanadas no cierra exacto.
    if (!combosComplete) return;
    // Show cross-sell only once, only when user has exactly 1 product type
    if (!crossSellShown && (
      (view === 'rifa-grid' && hasRaffle && !hasCombos) ||
      (view === 'combo-catalog' && hasCombos && !hasRaffle)
    )) {
      setView('cross-sell');
      return;
    }
    setView('form');
  };

  const handleCrossSellAccept = () => {
    setCrossSellShown(true);
    // Navigate to the other product
    setView(props.initialEntry === 'rifa' ? 'combo-catalog' : 'rifa-grid');
  };

  const handleCrossSellDecline = () => {
    setCrossSellShown(true);
    setView('form');
  };

  const handleSubmitForm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        buyer,
        raffle: hasRaffle ? { raffleId: props.raffleConfig.id, numberIds: selectedNumbers } : undefined,
        combos: hasCombos ? selectedCombos : undefined,
      };
      const res = await fetch('/api/order/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success: boolean; data?: { orderId: string }; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Error creando order');
      setOrderId(json.data?.orderId);
      setView('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReview = async () => {
    if (!orderId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/order/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const json = (await res.json()) as { success: boolean; data?: { initPoint: string }; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Error creando preference');
      window.location.href = json.data!.initPoint;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
      setIsSubmitting(false);
    }
  };

  const handleRestart = () => {
    setSelectedNumbers([]);
    setComboCount(0);
    setEmpanadaFlavors({ carne: 0, jyq: 0 });
    setCrossSellShown(false);
    setOrderId(undefined);
    setError(null);
    props.onBack();
  };

  const handleRemoveNumber = (n: number) => {
    // Pre-form: client-side remove only (post-form removal is handled via restart)
    setSelectedNumbers((curr) => curr.filter((x) => x !== n));
  };

  const handleChangeCombo = (delta: number) => {
    const next = Math.max(0, comboCount + delta);
    setComboCount(next);
    // Si bajás la cantidad de combos y los gustos ya asignados exceden el nuevo
    // total de empanadas, recortá el excedente (primero jamón y queso, luego carne).
    const maxEmp = empanadasForCombos(next);
    setEmpanadaFlavors((f) => {
      let { carne, jyq } = f;
      let sum = carne + jyq;
      while (sum > maxEmp && jyq > 0) { jyq--; sum--; }
      while (sum > maxEmp && carne > 0) { carne--; sum--; }
      return carne === f.carne && jyq === f.jyq ? f : { carne, jyq };
    });
  };

  const handleChangeFlavor = (flavorId: FlavorId, delta: number) => {
    setEmpanadaFlavors((f) => {
      const maxEmp = empanadasForCombos(comboCount);
      const sum = f.carne + f.jyq;
      if (delta > 0 && sum >= maxEmp) return f; // no exceder N×2
      const nextVal = Math.max(0, f[flavorId] + delta);
      return { ...f, [flavorId]: nextVal };
    });
  };

  const handleRemoveCombo = () => {
    setComboCount(0);
    setEmpanadaFlavors({ carne: 0, jyq: 0 });
  };

  const handleBack = () => {
    setError(null);
    if (view === 'review') {
      setView('form');
    } else if (view === 'form') {
      // If cross-sell was shown, go back to the catalog of the OTHER product
      // If not, go back to the initial selection view
      if (crossSellShown) {
        setView(props.initialEntry === 'rifa' ? 'combo-catalog' : 'rifa-grid');
      } else {
        setView(props.initialEntry === 'rifa' ? 'rifa-grid' : 'combo-catalog');
      }
    } else {
      // rifa-grid or combo-catalog: go back to home
      props.onBack();
    }
  };

  // Views that manage their own header (NumberGrid and ComboCatalog render AppHeader internally)
  // cross-sell uses a bottom sheet overlay — no top header needed from the wizard shell
  const viewHasOwnHeader = view === 'rifa-grid' || view === 'combo-catalog' || view === 'cross-sell';
  // Status views (success/failure/pending) also manage their own header
  const isStatusView = view === 'success' || view === 'failure' || view === 'pending';

  return (
    <PageContainer>
      {/* Only render outer AppHeader for form/review views;
          NumberGrid and ComboCatalog render their own header,
          and status screens (FailureScreen/PendingScreen) render theirs too */}
      {!viewHasOwnHeader && !isStatusView && (
        <AppHeader
          variant="wizard"
          title={
            view === 'form' ? 'Datos del comprador' :
            view === 'review' ? 'Confirmar compra' :
            ''
          }
          onBack={handleBack}
        />
      )}

      {error && !isStatusView && (
        <div className="mx-4 mt-3 bg-state-sold/10 text-state-sold border border-state-sold/30 rounded-md px-3 py-2 mb-3 text-sm">
          {error}
        </div>
      )}

      {view === 'rifa-grid' && (
        <NumberGrid
          numbers={props.numbers}
          totalNumbers={props.raffleConfig.totalNumbers}
          selected={selectedNumbers}
          pricePerNumber={props.raffleConfig.pricePerNumber}
          onSelectionChange={setSelectedNumbers}
          onContinue={handleContinueFromSelection}
          onBack={handleBack}
        />
      )}

      {view === 'combo-catalog' && (
        <ComboCatalog
          comboCount={comboCount}
          flavors={empanadaFlavors}
          onChangeCombo={handleChangeCombo}
          onChangeFlavor={handleChangeFlavor}
          onContinue={handleContinueFromSelection}
          onBack={handleBack}
        />
      )}

      {view === 'form' && (
        <main className="flex-1 px-4 py-4">
          <UnifiedBuyerForm
            hasRaffle={hasRaffle}
            data={buyer}
            onChange={setBuyer}
            onSubmit={handleSubmitForm}
            isSubmitting={isSubmitting}
          />
        </main>
      )}

      {view === 'review' && (
        <main className="flex-1 px-4 py-4">
          <UnifiedReview
            raffleNumbers={selectedNumbers}
            pricePerNumber={props.raffleConfig.pricePerNumber}
            combos={selectedCombos}
            buyer={buyer}
            total={total}
            onConfirm={handleConfirmReview}
            onBack={() => setView('form')}
            isConfirming={isSubmitting}
            raffleTitle={props.raffleConfig.title}
          />
        </main>
      )}

      {view === 'success' && (
        <main className="flex-1 px-4 py-4">
          <OrderSuccessScreen
            orderId={orderId ?? '—'}
            raffleNumbers={selectedNumbers.length > 0 ? selectedNumbers : undefined}
            combos={selectedCombos.length > 0 ? selectedCombos : undefined}
            total={total > 0 ? total : undefined}
            onRestart={handleRestart}
          />
        </main>
      )}

      {view === 'failure' && (
        <FailureScreen
          number={selectedNumbers[0] ?? null}
          onRestart={handleRestart}
          productType="order"
        />
      )}

      {view === 'pending' && (
        <PendingScreen
          onRestart={handleRestart}
          productType="order"
        />
      )}

      {/* StickyCartBar: visible when cart has items and not on status views */}
      {!isStatusView && itemCount > 0 && (
        <StickyCartBar
          itemCount={itemCount}
          total={total}
          onTap={() => setCartOpen(true)}
          ctaLabel={(view === 'rifa-grid' || (view === 'combo-catalog' && combosComplete)) ? 'Continuar' : undefined}
          onCta={(view === 'rifa-grid' || (view === 'combo-catalog' && combosComplete)) ? handleContinueFromSelection : undefined}
        />
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        raffleNumbers={selectedNumbers}
        combos={selectedCombos}
        pricePerNumber={props.raffleConfig.pricePerNumber}
        total={total}
        onRemoveNumber={handleRemoveNumber}
        onRemoveCombo={handleRemoveCombo}
      />

      <CrossSellSheet
        open={view === 'cross-sell'}
        onClose={handleCrossSellDecline}
        productSold={props.initialEntry}
        onAccept={handleCrossSellAccept}
        onDecline={handleCrossSellDecline}
      />
    </PageContainer>
  );
}
