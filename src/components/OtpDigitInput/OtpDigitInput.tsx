import { useEffect, useRef } from 'react';

/**
 * Controlled 6-box join-code input. Mirrors the peach pill grid in the
 * Join Project screen — each digit slot is a rounded peach square that
 * advances focus on input and goes back on Backspace.
 *
 * Accepts letters + digits (the mockup shows "JP82XC"); parent should
 * uppercase before storing.
 *
 * The value is fully controlled — parent owns the string state. This atom
 * just renders boxes and manages focus.
 */

interface OtpDigitInputProps {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  /** Render in error state (red ring) when the typed code fails validation. */
  error?: boolean;
  className?: string;
}

export function OtpDigitInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  error = false,
  className = '',
}: OtpDigitInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const padded = value.padEnd(length, ' ').slice(0, length);

  useEffect(() => {
    // Auto-focus first empty slot on mount
    const firstEmpty = padded.split('').findIndex(c => c === ' ');
    const target = firstEmpty === -1 ? length - 1 : firstEmpty;
    refs.current[target]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setChar(i: number, c: string) {
    const trimmed = c.replace(/\s/g, '').slice(0, 1).toUpperCase();
    const next = value.padEnd(length, ' ').split('');
    next[i] = trimmed || ' ';
    const joined = next.join('').replace(/\s+$/g, '');
    onChange(joined);
    if (trimmed && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !padded[i].trim() && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\s/g, '').toUpperCase().slice(0, length);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    refs.current[Math.min(text.length, length - 1)]?.focus();
  }

  return (
    <div className={`flex justify-center gap-2 ${className}`}>
      {Array.from({ length }, (_, i) => {
        const char = padded[i].trim();
        return (
          <input
            key={i}
            ref={el => { refs.current[i] = el; }}
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            maxLength={1}
            disabled={disabled}
            value={char}
            onChange={e => setChar(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            onPaste={handlePaste}
            className={
              'w-12 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-mono font-bold ' +
              'rounded-lg bg-brand-50 text-brand-800 caret-brand-500 ' +
              'outline-none transition-all duration-150 ' +
              (error
                ? 'ring-2 ring-danger'
                : 'focus:ring-2 focus:ring-brand-500 focus:bg-brand-100')
            }
          />
        );
      })}
    </div>
  );
}
