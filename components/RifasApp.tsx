'use client';

import { useState, useEffect, useCallback } from 'react';
import PageContainer from './layout/PageContainer';
import ProductSplitHero from './hero/ProductSplitHero';
import OrderFlow from './order/OrderFlow';
import SalesClosedScreen from './SalesClosedScreen';

// Cierre automático de ventas. ART = UTC-3.
const SALES_CLOSE_TS = new Date('2026-05-27T00:00:00-03:00').getTime();

// === Re-exported types (kept for backward-compat while old components still exist) ===

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

// ===

const POLLING_INTERVAL_MS = 30000;

export default function RifasApp() {
  const [view, setView] = useState<'home' | 'order'>('home');
  const [entry, setEntry] = useState<'rifa' | 'combo'>('rifa');
  const [raffleConfig, setRaffleConfig] = useState<RaffleConfig | null>(null);
  const [numbers, setNumbers] = useState<RaffleNumber[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failure' | 'pending' | undefined>();
  const [orderId, setOrderId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [salesClosed, setSalesClosed] = useState(() => Date.now() >= SALES_CLOSE_TS);

  // Vigilar el cruce de las 00:00 sin requerir refresh manual.
  useEffect(() => {
    if (salesClosed) return;
    const remaining = SALES_CLOSE_TS - Date.now();
    if (remaining <= 0) {
      setSalesClosed(true);
      return;
    }
    const id = setTimeout(() => setSalesClosed(true), remaining + 500);
    return () => clearTimeout(id);
  }, [salesClosed]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/raffle/config', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Config ${res.status}`);
      const data = (await res.json()) as RaffleConfig;
      setRaffleConfig(data);
    } catch (e) {
      console.error('loadConfig:', e);
      setLoadError('No pudimos cargar la información de la rifa.');
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
    }
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([loadConfig(), loadNumbers()]).finally(() => setIsLoading(false));
  }, [loadConfig, loadNumbers]);

  // Polling
  useEffect(() => {
    const id = setInterval(loadNumbers, POLLING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadNumbers]);

  // Query params post-MP redirect
  // New unified format: ?payment=success|failure|pending&order=ORD-xxx
  // Legacy combo format: ?combo=success|failure|pending&order=COM-xxx (handled by same branch)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    // Unified order redirect: ?payment=...&order=ORD-xxx
    const ps = params.get('payment') as 'success' | 'failure' | 'pending' | null;
    const order = params.get('order');
    if (ps && order) {
      setPaymentStatus(ps);
      setOrderId(order);
      setView('order');
      // Query params are cleaned up inside OrderFlow on mount
      return;
    }

    // Legacy rifa-only redirect: ?payment=...&purchase=PUR-xxx
    const purchase = params.get('purchase');
    if (ps && purchase) {
      setPaymentStatus(ps);
      setOrderId(purchase);
      setView('order');
    }
  }, []);

  // Hard gate: cierre por fecha. Aparece incluso si la API está caída.
  if (salesClosed) {
    return <SalesClosedScreen />;
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex-1 flex items-center justify-center text-ink-muted text-sm">
          Cargando…
        </div>
      </PageContainer>
    );
  }

  if (loadError || !raffleConfig) {
    return (
      <PageContainer>
        <div className="flex-1 flex items-center justify-center text-red-600 text-sm px-4 text-center">
          {loadError ?? 'No se pudo cargar la rifa. Recargá la página.'}
        </div>
      </PageContainer>
    );
  }

  // Soft gate: switch manual vía BD (UPDATE raffles SET is_active=false).
  if (!raffleConfig.isActive) {
    return <SalesClosedScreen />;
  }

  if (view === 'home') {
    const totalAvailable = numbers.filter((n) => n.status === 'available').length;
    return (
      <ProductSplitHero
        raffleAvailable={totalAvailable}
        rafflePrice={raffleConfig.pricePerNumber}
        onSelect={(product) => {
          setEntry(product);
          setView('order');
        }}
      />
    );
  }

  // view === 'order'
  return (
    <OrderFlow
      initialEntry={entry}
      raffleConfig={raffleConfig}
      numbers={numbers}
      onBack={() => {
        setView('home');
        setPaymentStatus(undefined);
        setOrderId(undefined);
      }}
      initialPaymentStatus={paymentStatus}
      initialOrderId={orderId}
      refreshNumbers={loadNumbers}
    />
  );
}
