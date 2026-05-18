/**
 * Tiny pill-shaped segmented control used to switch between two views
 * inside one section (e.g. Dashboard "Your Buckets / Partner's Buckets").
 *
 * Fully controlled: parent owns `value` and gets the new value via
 * `onChange`. Keeps the visual weight low — sits inline next to a
 * section label and doesn't compete with the page hierarchy.
 */

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
}

export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-pill bg-well p-1 shadow-neuPressed"
    >
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={
              'rounded-pill px-4 py-2 font-mono text-xs font-bold transition-all ' +
              (active
                ? 'bg-brand-500 text-ink-inverse shadow-haloOrange'
                : 'text-ink-muted hover:text-ink')
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
