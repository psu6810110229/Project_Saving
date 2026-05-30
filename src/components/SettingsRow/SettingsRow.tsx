import type { ReactNode } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';
import { IconArrowRight, IconLock } from '../Icon/Icon';

/**
 * One row in a Project Settings or Profile menu. Peach leading icon,
 * label + optional description, optional right-side meta (e.g. a count
 * or a chip), and a chevron at the end.
 *
 * `tone="danger"` recolors the label and icon for the Archive Project
 * row in the red danger zone.
 *
 * `locked` dims the row and swaps the chevron for a lock, signalling the
 * action needs a project first. The row stays tappable so `onClick` can
 * surface an explainer.
 */

type Tone = 'default' | 'danger';

interface SettingsRowProps {
  icon: ReactNode;
  label: string;
  description?: string;
  meta?: ReactNode;
  tone?: Tone;
  locked?: boolean;
  onClick?: () => void;
}

export function SettingsRow({
  icon,
  label,
  description,
  meta,
  tone = 'default',
  locked = false,
  onClick,
}: SettingsRowProps) {
  const labelClass = tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={locked}
      className={`w-full flex items-center gap-3 rounded-lg bg-surface shadow-soft p-3 active:scale-[0.99] transition-transform text-left ${locked ? 'opacity-60' : ''}`}
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
      {locked ? (
        <IconLock size={18} className="shrink-0 text-ink-muted" />
      ) : (
        <IconArrowRight size={18} className={`shrink-0 ${tone === 'danger' ? 'text-danger' : 'text-ink-muted'}`} />
      )}
    </button>
  );
}
