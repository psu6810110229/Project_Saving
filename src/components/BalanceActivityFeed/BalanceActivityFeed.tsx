import { IconBubble } from '../IconBubble/IconBubble';
import { IconCheck, IconVault } from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { formatRelativeTime } from '../../lib/format';
import { formatSignedCurrency, reasonLabel } from '../../lib/reconcile';
import type { BalanceActivityEntry } from '../../types';

interface BalanceActivityFeedProps {
  label?: string;
  items: BalanceActivityEntry[];
  /** User id of the viewer, used to label "You" vs partner. */
  currentUserId?: string;
  /** Default 3; clamped to >= 1. */
  previewLimit?: number;
}

/**
 * Sanitized, partner-visible Reconcile activity. Shows whether each
 * check matched or surfaced a difference, the reason when there was
 * one, and a signed difference amount. Notes and storage splits stay
 * private to the owner per plan 21.
 */
export function BalanceActivityFeed({
  label = 'Balance Activity',
  items,
  currentUserId,
  previewLimit = 3,
}: BalanceActivityFeedProps) {
  if (items.length === 0) return null;

  const limit = Math.max(1, previewLimit);
  const previewed = items.slice(0, limit);

  return (
    <section>
      <SectionLabel tone="brand">{label}</SectionLabel>
      <div className="mt-3 rounded-3xl bg-surface shadow-soft px-4 divide-y divide-well">
        {previewed.map(item => {
          const matched = item.difference_amount === 0;
          const actorName = item.user_id === currentUserId
            ? 'You'
            : item.display_name?.trim() || 'Partner';
          return (
            <div key={item.checkpoint_id} className="flex items-center gap-3 py-3">
              <IconBubble tone={matched ? 'peach' : 'muted'} size="md">
                {matched ? <IconCheck size={18} /> : <IconVault size={18} />}
              </IconBubble>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-ink">
                  <span className="font-bold">{actorName}</span>
                  {matched
                    ? ' checked balance — amounts matched'
                    : ` checked balance — ${formatSignedCurrency(item.difference_amount)}`}
                </p>
                <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">
                  {item.reason ? `${reasonLabel(item.reason)} · ` : ''}{formatRelativeTime(item.checked_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
