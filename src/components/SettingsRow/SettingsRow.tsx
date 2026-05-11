import type { ReactNode } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';
import { IconArrowRight } from '../Icon/Icon';

/**
 * One row in a Project Settings or Profile menu. Peach leading icon,
 * label + optional description, optional right-side meta (e.g. a count
 * or a chip), and a chevron at the end.
 *
 * `tone="danger"` recolors the label and icon for the Archive Project
 * row in the red danger zone.
 */

type Tone = 'default' | 'danger';

interface SettingsRowProps {
  icon: ReactNode;
  label: string;
  description?: string;
  meta?: ReactNode;
  tone?: Tone;
  onClick?: () => void;
}

export function SettingsRow({
  icon,
  label,
  description,
  meta,
  tone = 'default',
  onClick,
}: SettingsRowProps) {
  const labelClass = tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl bg-surface shadow-soft p-3 active:scale-[0.99] transition-transform text-left"
    >
      <IconBubble tone={tone === 'danger' ? 'muted' : 'peach'} size="md">
        <span className={tone === 'danger' ? 'text-danger' : ''}>{icon}</span>
      </IconBubble>
      <div className="flex-1 min-w-0">
        <div className={`font-mono text-sm font-bold ${labelClass} truncate`}>{label}</div>
        {description && (
          <div className="mt-0.5 font-mono text-xs text-ink-muted truncate">{description}</div>
        )}
      </div>
      {meta && <div className="shrink-0">{meta}</div>}
      <IconArrowRight size={18} className={`shrink-0 ${tone === 'danger' ? 'text-danger' : 'text-ink-muted'}`} />
    </button>
  );
}
