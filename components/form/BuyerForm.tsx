import { useState } from 'react';
import AppHeader from '../layout/AppHeader';
import StickyBottomBar from '../layout/StickyBottomBar';
import FormField from './FormField';
import StudentBlock from './StudentBlock';
import type { FormData } from '../RifasApp';

interface BuyerFormProps {
  initialValue: FormData;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (data: FormData) => void;
  onBack: () => void;
}

type FieldErrors = Partial<Record<keyof FormData, string>>;

function validate(data: FormData): FieldErrors {
  const errors: FieldErrors = {};
  if (!data.buyerName.trim()) errors.buyerName = 'Requerido';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email.trim())) errors.email = 'Email inválido';
  if (!data.phone.trim()) errors.phone = 'Requerido';
  if (!data.studentName.trim()) errors.studentName = 'Requerido';
  if (!data.course.trim()) errors.course = 'Requerido';
  if (!data.division.trim()) errors.division = 'Requerido';
  return errors;
}

export default function BuyerForm({
  initialValue,
  isSubmitting,
  errorMessage,
  onSubmit,
  onBack,
}: BuyerFormProps) {
  const [data, setData] = useState<FormData>(initialValue);
  const [errors, setErrors] = useState<FieldErrors>({});

  const handleChange = (name: string, value: string) => {
    setData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(data);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="contents">
      <AppHeader variant="wizard" title="Tus datos" meta="2 / 4" onBack={onBack} />

      <div className="flex-1 px-4 py-5 flex flex-col gap-3 overflow-y-auto">
        <h2 className="text-lg font-bold text-ink leading-tight tracking-tight-1">
          ¿A nombre de quién va el número?
        </h2>
        <p className="text-xs text-ink-soft -mt-1">
          Si ganás te contactamos por estos datos.
        </p>

        <FormField
          label="Nombre del comprador"
          name="buyerName"
          value={data.buyerName}
          onChange={handleChange}
          placeholder="Tu nombre completo"
          error={errors.buyerName}
          autoComplete="name"
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          value={data.email}
          onChange={handleChange}
          placeholder="tucorreo@gmail.com"
          error={errors.email}
          autoComplete="email"
          inputMode="email"
        />
        <FormField
          label="Teléfono"
          name="phone"
          type="tel"
          value={data.phone}
          onChange={handleChange}
          placeholder="+54 9 11 …"
          error={errors.phone}
          autoComplete="tel"
          inputMode="tel"
        />

        <StudentBlock
          studentName={data.studentName}
          course={data.course}
          division={data.division}
          onChange={handleChange}
          errors={{
            studentName: errors.studentName,
            course: errors.course,
            division: errors.division,
          }}
        />

        {errorMessage && (
          <div className="bg-state-sold/10 border border-state-sold text-state-sold rounded-banner px-3 py-2 text-xs">
            {errorMessage}
          </div>
        )}
      </div>

      <StickyBottomBar>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-brand text-white text-sm font-semibold py-2.5 rounded-ctl hover:bg-brand/90 disabled:bg-ink-muted disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Reservando…' : 'Revisar compra →'}
        </button>
      </StickyBottomBar>
    </form>
  );
}
