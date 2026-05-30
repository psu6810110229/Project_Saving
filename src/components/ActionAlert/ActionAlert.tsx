import { memo, useEffect, useMemo, useState } from 'react';
import { Button } from '../Button/Button';
import { IconArrowRight, IconWarning, IconX } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';

type ActionAlertCopy = ReturnType<typeof useI18n>['copy']['dashboard']['actionAlert'];

export interface ActionAlertBucket {
  id: string;
  name: string;
  status: 'behind' | 'critical';
  remainingAmount: number;
  remainingDays: number;
  requiredPerDay: number | null;
}

interface ActionAlertProps {
  buckets: ActionAlertBucket[];
  storageKey: string;
  formatMoney: (amount: number) => string;
  onViewBucket: (bucketId: string) => void;
}

export const ActionAlert = memo(function ActionAlert({
  buckets,
  storageKey,
  formatMoney,
  onViewBucket,
}: ActionAlertProps) {
  const { copy } = useI18n();
  const t = copy.dashboard.actionAlert;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(storageKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  const sortedBuckets = useMemo(() => [...buckets].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'critical' ? -1 : 1;
    return (b.requiredPerDay ?? 0) - (a.requiredPerDay ?? 0);
  }), [buckets]);

  const primary = sortedBuckets[0];
  if (!primary || dismissed) return null;

  const critical = sortedBuckets.some(bucket => bucket.status === 'critical');
  const title = sortedBuckets.length === 1
    ? singleBucketTitle(primary, formatMoney, t)
    : t.multiTitle(sortedBuckets.length);
  const body = sortedBuckets.length === 1
    ? (primary.status === 'critical' ? t.bodySingleCritical : t.bodySingleBehind)
    : critical
      ? t.bodyMultiCritical
      : t.bodyMultiBehind;
  const toneClasses = critical
    ? 'border-danger/20 bg-danger-soft text-danger'
    : 'border-brand-100 bg-brand-50 text-brand-800';
  const iconClasses = critical
    ? 'bg-surface text-danger'
    : 'bg-surface text-brand-700';

  function dismiss() {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(storageKey, '1');
    } catch {
      // Session dismissal is nice-to-have; local state still hides it.
    }
  }

  return (
    <section className={`rounded-xl border p-4 shadow-soft ${toneClasses}`} aria-live="polite">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${iconClasses}`}>
          <IconWarning size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-bold leading-snug text-ink">{title}</p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-ink-muted">{body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant={critical ? 'dangerSoft' : 'secondary'}
              size="sm"
              trailingIcon={<IconArrowRight size={14} />}
              onClick={() => onViewBucket(primary.id)}
            >
              {sortedBuckets.length === 1 ? t.viewButton : t.viewDetailsButton}
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label={t.dismissAria}
          onClick={dismiss}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-surface/80 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <IconX size={16} />
        </button>
      </div>
    </section>
  );
});

function singleBucketTitle(
  bucket: ActionAlertBucket,
  formatMoney: (amount: number) => string,
  t: ActionAlertCopy,
): string {
  const state = bucket.status === 'critical' ? t.stateCritical : t.stateBehind;
  if (bucket.requiredPerDay && bucket.requiredPerDay > 0) {
    return t.singleTitlePerDay(bucket.name, state, formatMoney(Math.ceil(bucket.requiredPerDay)));
  }
  if (bucket.remainingDays <= 0 && bucket.remainingAmount > 0) {
    return t.singleTitleNeeded(bucket.name, state, formatMoney(Math.ceil(bucket.remainingAmount)));
  }
  return t.singleTitlePlain(bucket.name, state);
}
