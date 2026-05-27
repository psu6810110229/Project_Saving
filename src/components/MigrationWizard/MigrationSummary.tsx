import type { DailySummaryItem } from '../../types';
import { Button } from '../Button/Button';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { IconCheckCircle, IconFire } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';

interface MigrationSummaryProps {
  items: DailySummaryItem[];
  streak: number;
  streakUnit?: string;
  onComplete: () => void;
}

export function MigrationSummary({ items, streak, streakUnit, onComplete }: MigrationSummaryProps) {
  const { formatMoney } = useI18n();
  const todayAmount = items.reduce((total, item) => total + (item.amountDue ?? 0), 0);
  const focusName = items[0]?.bucketName ?? 'your first goal';

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-surface p-5 shadow-soft">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-green-700">
          <IconCheckCircle size={24} />
        </span>
        <h3 className="font-mono text-2xl font-bold leading-tight text-ink">You're all set</h3>
        <p className="mt-2 font-mono text-sm leading-relaxed text-ink-muted">
          Your goals now have deadlines and a saving rhythm. The dashboard will keep the next step clear.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-well p-4">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink-dim">Today</p>
          <p className="mt-2 font-mono text-xl font-bold text-ink">{formatMoney(todayAmount)}</p>
          <p className="mt-1 font-mono text-[11px] text-ink-muted">Focus: {focusName}</p>
        </div>
        <div className="rounded-xl bg-well p-4">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink-dim">Streak</p>
          <p className="mt-2 flex items-center gap-1.5 font-mono text-xl font-bold text-ink">
            <IconFire size={18} className="text-brand-700" />
            {streak}
          </p>
          <p className="mt-1 font-mono text-[11px] text-ink-muted">
            {streakUnit ? `${streakUnit} preserved` : 'Preserved'}
          </p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 shadow-soft">
          {items.slice(0, 3).map(item => (
            <div key={item.bucketId} className="flex items-center gap-3 rounded-lg bg-well px-3 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-ink-muted">
                <BucketCategoryIcon category={item.category} size={16} />
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-ink">{item.bucketName}</span>
              <span className="shrink-0 font-mono text-xs text-ink-muted">
                {item.amountDue != null ? formatMoney(item.amountDue) : item.periodLabel}
              </span>
            </div>
          ))}
        </div>
      )}

      <Button variant="action" fullWidth onClick={onComplete}>
        Start saving
      </Button>
    </div>
  );
}
