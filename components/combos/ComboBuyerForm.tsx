'use client';

import { useState } from 'react';
import PageContainer from '../layout/PageContainer';
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import FormField from '../form/FormField';

export interface ComboBuyer {
  name: string;
  email: string;
  phone: string;
}

interface ComboBuyerFormProps {
  initial?: Partial<ComboBuyer>;
  onSubmit: (buyer: ComboBuyer) => void;
  onBack: () => void;
}

export default function ComboBuyerForm({ initial, onSubmit, onBack }: ComboBuyerFormProps) {
  const [fields, setFields] = useState<ComboBuyer>({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ComboBuyer, string>>>({});

  function handleChange(fieldName: string, value: string): void {
    setFields((prev) => ({ ...prev, [fieldName]: value }));
    if (errors[fieldName as keyof ComboBuyer]) {
      setErrors((prev) => ({ ...prev, [fieldName]: undefined }));
    }
  }

  function validate(): boolean {
    const next: Partial<Record<keyof ComboBuyer, string>> = {};
    if (!fields.name.trim()) next.name = 'Nombre requerido';
    if (!fields.email.trim()) next.email = 'Email requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) next.email = 'Email inválido';
    if (!fields.phone.trim()) next.phone = 'Teléfono requerido';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      name: fields.name.trim(),
      email: fields.email.trim(),
      phone: fields.phone.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="contents">
      <PageContainer>
        <AppHeader variant="wizard" onBack={onBack} title="Tus datos" />
        <main className="px-5 pt-4 pb-32 flex flex-col gap-4">
          <FormField
            label="Nombre y apellido"
            name="name"
            value={fields.name}
            onChange={handleChange}
            error={errors.name}
            autoComplete="name"
            required
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            value={fields.email}
            onChange={handleChange}
            error={errors.email}
            autoComplete="email"
            required
          />
          <FormField
            label="Teléfono"
            name="phone"
            type="tel"
            value={fields.phone}
            onChange={handleChange}
            error={errors.phone}
            autoComplete="tel"
            required
          />
          <p className="text-xs text-ink-muted mt-2">
            Te vamos a enviar el comprobante por email. El día del evento, retirá tu pedido con tu nombre y código.
          </p>
        </main>
        <StickyBottomBar>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand text-white py-3 text-sm font-bold"
          >
            Continuar →
          </button>
        </StickyBottomBar>
      </PageContainer>
    </form>
  );
}
