import { THEME_SWATCH_ORDER, themeSwatches, type ThemeSwatch } from '../../lib/theme';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { useI18n } from '../../i18n/useI18n';

/**
 * Profile → Theme Colors swatch picker. Mirrors the available swatches
 * from `themeSwatches`.
 */

interface ThemeSwatchPickerProps {
  value: ThemeSwatch;
  onChange: (next: ThemeSwatch) => void;
  label?: string;
}

export function ThemeSwatchPicker({ value, onChange, label }: ThemeSwatchPickerProps) {
  const { copy } = useI18n();
  const resolvedLabel = label ?? copy.sharedControls.themeColors;
  return (
    <div>
      <SectionLabel tone="muted">{resolvedLabel}</SectionLabel>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {THEME_SWATCH_ORDER.map(key => {
          const hex = themeSwatches[key];
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-label={copy.sharedControls.selectTheme(key)}
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
