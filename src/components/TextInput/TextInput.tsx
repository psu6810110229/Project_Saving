import type { InputHTMLAttributes, ReactNode } from 'react';

/**
 * Pill-shaped text input used on the Create Project and Create Bucket
 * forms. Soft `brand-100` border on the peach `surfaceAlt` background,
 * with optional leading icon (e.g. pencil for name field, ฿ for amount).
 *
 * Wraps a native `<input>` — `value`, `onChange`, `type`, `placeholder`
 * etc. all pass through. The parent form composes this with the label
 * above it (label is a separate atom; this stays focused on the input).
 */

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  error?: boolean;
}

export function TextInput({
  leadingIcon,
  trailingIcon,
  error = false,
  className = '',
  ...rest
}: TextInputProps) {
  return (
    <label
      className={
        'flex items-center gap-2 rounded-pill px-4 py-3 ' +
        'bg-surfaceAlt border ' +
        (error
          ? 'border-danger focus-within:border-danger'
          : 'border-brand-100 focus-within:border-brand-500') +
        ` transition-colors duration-200 ${className}`
      }
    >
      {leadingIcon && (
        <span className="text-brand-300 shrink-0">{leadingIcon}</span>
      )}
      <input
        {...rest}
        className={
          'flex-1 bg-transparent outline-none text-ink ' +
          'placeholder:text-brand-300 ' +
          'font-mono text-sm'
        }
      />
      {trailingIcon && (
        <span className="text-brand-300 shrink-0">{trailingIcon}</span>
      )}
    </label>
  );
}
