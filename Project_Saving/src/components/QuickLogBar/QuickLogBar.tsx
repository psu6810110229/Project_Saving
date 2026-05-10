import { useState } from 'react';
import { formatCurrency } from '../../lib/format';

const PRESETS = [100, 500, 1000];

interface Props {
  onInsert: (amount: number) => Promise<{ error?: string }>;
  onPreview?: (amount: number) => void;
}

export function QuickLogBar({ onInsert, onPreview }: Props) {
  const [errorMsg, setErrorMsg] = useState('');

  async function handleClick(amount: number) {
    setErrorMsg('');
    const { error } = await onInsert(amount);
    if (error) setErrorMsg(error);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-ink-muted uppercase tracking-widest">Quick log</span>
      <div className="flex gap-2">
        {PRESETS.map(amount => (
          <button
            key={amount}
            onClick={() => handleClick(amount)}
            onPointerEnter={() => onPreview?.(amount)}
            onPointerLeave={() => onPreview?.(0)}
            className="flex-1 bg-surface border border-border rounded-lg py-3 text-sm font-medium text-ink active:bg-border transition-colors hover:border-terracotta hover:text-terracotta"
          >
            +{formatCurrency(amount)}
          </button>
        ))}
      </div>
      {errorMsg && <p className="text-red-500 text-xs">{errorMsg}</p>}
    </div>
  );
}
