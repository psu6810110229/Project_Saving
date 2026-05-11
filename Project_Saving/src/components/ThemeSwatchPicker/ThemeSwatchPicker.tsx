import { themeSwatches, type ThemeSwatch } from '../../lib/theme';
import { SectionLabel } from '../SectionLabel/SectionLabel';

/**
 * Profile → Theme Colors swatch picker. Three round swatches (terracotta
 * / slate / teal) mirroring the three options on the profile-update
 * screen.
 */

interface ThemeSwatchPickerProps {
  value: ThemeSwatch;
  onChange: (next: ThemeSwatch) => void;
  label?: string;
}

const ORDER: ThemeSwatch[] = ['terracotta', 'slate', 'teal'];

export function ThemeSwatchPicker({ value, onChange, label = 'Theme Colors' }: ThemeSwatchPickerProps) {
  return (
    <div>
      <SectionLabel tone="muted">{label}</SectionLabel>
      <div className="mt-3 flex items-center gap-4">
        {ORDER.map(key => {
          const hex = themeSwatches[key];
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-label={`Select ${key} theme`}
              aria-pressed={selected}
              className={
                'flex flex-col items-center gap-1.5 transition-transform active:scale-[0.95] ' +
                (selected ? '' : 'opacity-70 hover:opacity-100')
              }
            >
              <span
                className="w-10 h-10 rounded-full"
                style={{
                  backgroundColor: hex,
                  boxShadow: selected
                    ? `0 0 0 3px #FBF6F0, 0 0 0 5px ${hex}`
                    : 'none',
                }}
              />
              <span className={`text-[11px] font-mono uppercase tracking-wide ${selected ? 'text-brand-800 font-bold' : 'text-ink-muted'}`}>
                {key}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
