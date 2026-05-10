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
    <div className="flex flex-col gap-3">
      <span className="text-xs text-ink-muted uppercase tracking-widest font-semibold">Quick log</span>
      <div className="flex gap-3">
        {PRESETS.map(amount => (
          <button
            key={amount}
            onClick={() => handleClick(amount)}
            onPointerEnter={() => onPreview?.(amount)}
            onPointerLeave={() => onPreview?.(0)}
            className="
              flex-1 bg-surface border border-border rounded-xl py-4
              text-base font-bold text-ink
              shadow-sm
              hover:bg-terracotta hover:text-white hover:border-terracotta hover:shadow-md
              active:scale-95
              transition-all duration-150
            "
          >
            +{formatCurrency(amount)}
          </button>
        ))}
      </div>
      {errorMsg && <p className="text-red-500 text-xs">{errorMsg}</p>}
    </div>
  );
}
