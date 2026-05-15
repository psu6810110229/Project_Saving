interface NotificationToggleProps {
  checked: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Settings switch used for the master and category notification
 * toggles. Reuses the warm brand-500 fill so it matches the rest of
 * the app instead of introducing a new control style.
 */
export function NotificationToggle({ checked, label, description, disabled, onChange }: NotificationToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        'w-full flex items-center gap-3 rounded-xl bg-surface shadow-soft p-3 text-left transition-opacity '
        + (disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99]')
      }
    >
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm font-bold text-ink">{label}</div>
        {description && (
          <div className="mt-0.5 font-mono text-xs text-ink-muted">{description}</div>
        )}
      </div>
      <span
        aria-hidden
        className={
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors '
          + (checked ? 'bg-brand-500' : 'bg-well')
        }
      >
        <span
          className={
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow-soft transition-transform '
            + (checked ? 'translate-x-5' : 'translate-x-0')
          }
        />
      </span>
    </button>
  );
}
