'use client';

import { useCallback, useEffect, useState } from 'react';
import PageContainer from './layout/PageContainer';
import HeroLanding from './hero/HeroLanding';
import NumberGrid from './grid/NumberGrid';

// === Types ===

export interface RaffleConfig {
  id: number;
  title: string;
  totalNumbers: number;
  pricePerNumber: number;
  isActive: boolean;
}

export interface RaffleNumber {
  id: number;
  number: number;
  status: 'available' | 'reserved' | 'sold';
}

export interface FormData {
  buyerName: string;
  email: string;
  phone: string;
  studentName: string;
  course: string;
  division: string;
}

export type Step = 'hero' | 'grid' | 'form' | 'review' | 'success' | 'failure' | 'pending';

const EMPTY_FORM: FormData = {
  buyerName: '',
  email: '',
  phone: '',
  studentName: '',
  course: '',
  division: '',
};

const POLLING_INTERVAL_MS = 30000;

export default function RifasApp() {
  // === State ===
  const [raffleConfig, setRaffleConfig] = useState<RaffleConfig | null>(null);
  const [numbers, setNumbers] = useState<RaffleNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('hero');
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // === API wrappers ===
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/raffle/config', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Config ${res.status}`);
      setRaffleConfig(await res.json());
    } catch (e) {
      console.error('loadConfig:', e);
      setError('No pudimos cargar la información de la rifa.');
    }
  }, []);

  const loadNumbers = useCallback(async () => {
    try {
      const res = await fetch(`/api/numbers?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error(`Numbers ${res.status}`);
      const data = (await res.json()) as RaffleNumber[];
      setNumbers(data);
    } catch (e) {
      console.error('loadNumbers:', e);
      setError('No pudimos cargar los números. Reintentá en unos segundos.');
    }
  }, []);

  const createPurchase = useCallback(async (data: FormData, number: number, totalAmount: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: data.buyerName,
          studentName: data.studentName,
          division: data.division,
          course: data.course,
          email: data.email,
          phone: data.phone,
          numbers: [number],
          totalAmount,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || 'No se pudo reservar el número');
      }
      setPurchaseId(body.purchaseId as string);
      setCurrentStep('review');
    } catch (e) {
      console.error('createPurchase:', e);
      setError(e instanceof Error ? e.message : 'Error al crear la compra');
      await loadNumbers();
      setCurrentStep('grid');
    } finally {
      setIsLoading(false);
    }
  }, [loadNumbers]);

  const startPayment = useCallback(async () => {
    if (!purchaseId || !selectedNumber || !raffleConfig) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId,
          buyerName: formData.buyerName,
          email: formData.email,
          numbers: [selectedNumber],
          totalAmount: raffleConfig.pricePerNumber,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success || !body.initPoint) {
        throw new Error(body.error || 'No se pudo iniciar el pago');
      }
      window.location.href = body.initPoint as string;
    } catch (e) {
      console.error('startPayment:', e);
      setError(e instanceof Error ? e.message : 'Error al iniciar el pago');
      setIsLoading(false);
    }
  }, [purchaseId, selectedNumber, raffleConfig, formData]);

  // === Effects ===

  // Initial load + polling
  useEffect(() => {
    loadConfig();
    loadNumbers();
    const id = setInterval(loadNumbers, POLLING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadConfig, loadNumbers]);

  // Detect status redirect from MP callback (?payment=success|failure|pending)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const purchase = params.get('purchase');
    const pid = params.get('payment_id');
    if (payment === 'success' && purchase) {
      setPurchaseId(purchase);
      if (pid) setPaymentId(pid);
      setCurrentStep('success');
    } else if (payment === 'failure' && purchase) {
      setPurchaseId(purchase);
      setCurrentStep('failure');
    } else if (payment === 'pending' && purchase) {
      setPurchaseId(purchase);
      if (pid) setPaymentId(pid);
      setCurrentStep('pending');
    }
  }, []);

  // === Step actions ===

  const goToGrid = useCallback(() => {
    setError(null);
    setCurrentStep('grid');
  }, []);

  const goToForm = useCallback(() => {
    if (!selectedNumber) return;
    setError(null);
    setCurrentStep('form');
  }, [selectedNumber]);

  const goToReview = useCallback(async (latestForm: FormData) => {
    if (!selectedNumber || !raffleConfig) return;
    await createPurchase(latestForm, selectedNumber, raffleConfig.pricePerNumber);
  }, [selectedNumber, raffleConfig, createPurchase]);

  const goBack = useCallback(() => {
    setError(null);
    if (currentStep === 'grid') setCurrentStep('hero');
    else if (currentStep === 'form') setCurrentStep('grid');
    else if (currentStep === 'review') setCurrentStep('form');
  }, [currentStep]);

  const restart = useCallback(() => {
    setSelectedNumber(null);
    setFormData(EMPTY_FORM);
    setPurchaseId(null);
    setPaymentId(null);
    setError(null);
    setCurrentStep('hero');
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
    loadNumbers();
  }, [loadNumbers]);

  // === Render ===

  if (!raffleConfig) {
    return (
      <PageContainer>
        <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">
          Cargando…
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {currentStep === 'hero' && (
        <HeroLanding
          raffleTitle={raffleConfig.title}
          pricePerNumber={raffleConfig.pricePerNumber}
          totalNumbers={raffleConfig.totalNumbers}
          availableCount={numbers.filter((n) => n.status === 'available').length}
          onStart={goToGrid}
        />
      )}
      {currentStep === 'grid' && (
        <NumberGrid
          numbers={numbers}
          totalNumbers={raffleConfig.totalNumbers}
          selectedNumber={selectedNumber}
          pricePerNumber={raffleConfig.pricePerNumber}
          onSelect={setSelectedNumber}
          onContinue={goToForm}
          onBack={goBack}
        />
      )}
      {currentStep === 'form' && <div>Form placeholder</div>}
      {currentStep === 'review' && <div>Review placeholder</div>}
      {currentStep === 'success' && <div>Success placeholder</div>}
      {currentStep === 'failure' && <div>Failure placeholder</div>}
      {currentStep === 'pending' && <div>Pending placeholder</div>}
    </PageContainer>
  );
}
