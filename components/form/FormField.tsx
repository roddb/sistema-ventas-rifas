import { ChangeEvent, InputHTMLAttributes } from 'react';

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'name'> {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
}

export default function FormField({
  label,
  name,
  value,
  onChange,
  error,
  ...inputProps
}: FormFieldProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(name, e.target.value);
  };
  const id = `field-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-[10px] font-semibold text-ink-soft uppercase tracking-[0.04em]"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        className={`bg-surface-raised border rounded-ctl px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none transition-colors ${
          error ? 'border-state-sold' : 'border-line focus:border-brand'
        }`}
        {...inputProps}
      />
      {error && <span className="text-xs text-state-sold mt-0.5">{error}</span>}
    </div>
  );
}
