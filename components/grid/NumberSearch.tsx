import { Search } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface NumberSearchProps {
  totalNumbers: number;
  onFound: (n: number) => void;
}

export default function NumberSearch({ totalNumbers, onFound }: NumberSearchProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const n = Number(value.trim());
    if (!Number.isInteger(n) || n < 1 || n > totalNumbers) {
      setError(`Ingresá un número entre 1 y ${totalNumbers}`);
      return;
    }
    setError(null);
    onFound(n);
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="px-3 py-2 bg-surface-raised border-b border-line">
      <label className="flex items-center gap-2 bg-surface-raised border border-line rounded-ctl px-3 py-2 focus-within:border-brand transition-colors">
        <Search className="w-4 h-4 text-ink-muted" aria-hidden="true" />
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder="Buscá un número específico"
          className="flex-1 outline-none bg-transparent text-sm text-ink placeholder:text-ink-muted"
          aria-label="Buscar número"
        />
      </label>
      {error && <p className="text-xs text-state-sold mt-1">{error}</p>}
    </form>
  );
}
