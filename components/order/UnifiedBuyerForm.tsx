'use client';

import FormField from '@/components/form/FormField';
import StudentBlock from '@/components/form/StudentBlock';

export interface BuyerData {
  name: string;
  email: string;
  phone: string;
  studentName?: string;
  division?: string;
  course?: string;
}

interface UnifiedBuyerFormProps {
  hasRaffle: boolean;
  data: BuyerData;
  onChange: (data: BuyerData) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export default function UnifiedBuyerForm({ hasRaffle, data, onChange, onSubmit, isSubmitting }: UnifiedBuyerFormProps) {
  const updateField = (field: keyof BuyerData, value: string) => onChange({ ...data, [field]: value });

  const isValid =
    data.name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(data.email) &&
    data.phone.trim().length > 0 &&
    (!hasRaffle || (
      (data.studentName ?? '').trim().length > 0 &&
      (data.division ?? '').trim().length > 0 &&
      (data.course ?? '').trim().length > 0
    ));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (isValid && !isSubmitting) onSubmit(); }}
      className="contents"
    >
      <div className="space-y-4">
        <FormField
          name="name"
          label="Nombre del comprador"
          value={data.name}
          onChange={(_, v) => updateField('name', v)}
          required
        />
        <FormField
          name="email"
          label="Email"
          type="email"
          value={data.email}
          onChange={(_, v) => updateField('email', v)}
          required
        />
        <FormField
          name="phone"
          label="Teléfono"
          type="tel"
          value={data.phone}
          onChange={(_, v) => updateField('phone', v)}
          required
        />
        {hasRaffle && (
          <StudentBlock
            studentName={data.studentName ?? ''}
            division={data.division ?? ''}
            course={data.course ?? ''}
            onChange={(field, value) => updateField(field as keyof BuyerData, value)}
          />
        )}
      </div>
      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="w-full bg-brand text-white rounded-ctl py-3 font-semibold mt-6 disabled:opacity-50"
      >
        {isSubmitting ? 'Enviando...' : 'Continuar al review'}
      </button>
    </form>
  );
}
