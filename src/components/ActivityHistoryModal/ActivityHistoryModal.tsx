import { useMemo, useState } from 'react';
import { ActivityTimelineRow } from '../ActivityTimelineRow/ActivityTimelineRow';
import { FormField } from '../FormField/FormField';
import { IconBubble } from '../IconBubble/IconBubble';
import { IconArrowRight, IconTrash } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { Segmented } from '../Segmented/Segmented';
import { TextInput } from '../TextInput/TextInput';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { useI18n } from '../../i18n/useI18n';
import type { BucketActivityEvent } from '../../hooks/useBucketActivityEvents';

export interface ActivityHistoryItem {
  id: string;
  actorName: string;
  actorFallback: string;
  actorAvatarUrl?: string | null;
  bucketName: string;
  amount: number;
  occurredAt: string;
  hasSlip?: boolean;
  slipUrl?: string | null;
}

export interface ActivityHistoryBucketEventItem {
  event: BucketActivityEvent;
  actorName: string;
  actorFallback: string;
  actorAvatarUrl?: string | null;
}

interface ActivityHistoryModalProps {
  open: boolean;
  onClose: () => void;
  items: ActivityHistoryItem[];
  /** Bucket transfer / remove events from `activity_events` to merge into the same date groups. */
  bucketEvents?: ActivityHistoryBucketEventItem[];
}

type SortOrder = 'newest' | 'oldest' | 'largest';

const SORT_STORAGE_KEY = 'activity-history:sort';

/**
 * Full activity history modal opened from the "View all" button on
 * the Dashboard's recent-activity feed. Groups deposits by date,
 * supports a free-text search across actor + bucket names + amount,
 * and offers three sort orders (newest / oldest / largest amount).
 *
 * Sort preference persists per browser via localStorage so opening
 * the modal again restores the previously-used sort. Search resets
 * on each open intentionally — it's a quick scan tool, not a saved
 * filter.
 */
type HistoryRow =
  | { kind: 'deposit'; at: string; item: ActivityHistoryItem }
  | { kind: 'bucket_event'; at: string; item: ActivityHistoryBucketEventItem };

function bucketEventSearchText(event: BucketActivityEvent): string {
  const payload = event.payload as Record<string, unknown>;
  return Object.values(payload)
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase();
}

export function ActivityHistoryModal({ open, onClose, items, bucketEvents = [] }: ActivityHistoryModalProps) {
  const { copy, formatLocalDateLabel } = useI18n();
  const d = copy.dashboard;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useLocalStorageState<SortOrder>(SORT_STORAGE_KEY, 'newest');

  const rows: HistoryRow[] = useMemo(() => {
    const deposits: HistoryRow[] = items.map(item => ({ kind: 'deposit', at: item.occurredAt, item }));
    const events: HistoryRow[] = bucketEvents.map(item => ({
      kind: 'bucket_event',
      at: item.event.created_at,
      item,
    }));
    return [...deposits, ...events];
  }, [items, bucketEvents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? rows.filter(row => {
        if (row.kind === 'deposit') {
          return row.item.actorName.toLowerCase().includes(q)
            || row.item.bucketName.toLowerCase().includes(q)
            || String(row.item.amount).includes(q);
        }
        return row.item.actorName.toLowerCase().includes(q)
          || bucketEventSearchText(row.item.event).includes(q)
          || (row.item.event.amount != null && String(row.item.event.amount).includes(q));
      })
      : rows;
    const sorted = [...matches];
    const amountOf = (row: HistoryRow): number =>
      row.kind === 'deposit' ? row.item.amount : (row.item.event.amount ?? 0);
    if (sort === 'newest') sorted.sort((a, b) => b.at.localeCompare(a.at));
    if (sort === 'oldest') sorted.sort((a, b) => a.at.localeCompare(b.at));
    if (sort === 'largest') sorted.sort((a, b) => amountOf(b) - amountOf(a));
    return sorted;
  }, [rows, query, sort]);

  const grouped = useMemo(
    () => groupByDate(filtered, formatLocalDateLabel),
    [filtered, formatLocalDateLabel],
  );

  return (
    <Modal open={open} title={d.activityHistory} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <FormField label={d.activitySearch}>
          <TextInput
            value={query}
            placeholder={d.activitySearchPlaceholder}
            onChange={event => setQuery(event.target.value)}
          />
        </FormField>
        <div className="flex justify-end">
          <Segmented<SortOrder>
            ariaLabel={d.activitySortAriaLabel}
            options={[
              { value: 'newest', label: d.activitySortNewest },
              { value: 'oldest', label: d.activitySortOldest },
              { value: 'largest', label: d.activitySortLargest },
            ]}
            value={sort}
            onChange={setSort}
          />
        </div>
        {grouped.length === 0 && (
          <p className="rounded-lg bg-well px-4 py-3 font-mono text-xs text-ink-muted">
            {query ? d.activityNoMatchSearch : d.activityNoDeposits}
          </p>
        )}
        <div className="flex flex-col gap-3 max-h-[60dvh] overflow-y-auto">
          {grouped.map(group => (
            <section key={group.label}>
              <h3 className="sticky top-0 z-10 bg-surface py-1 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                {group.label}
              </h3>
              <div className="rounded-lg bg-well/40 px-3 divide-y divide-well">
                {group.rows.map(row => (
                  row.kind === 'deposit'
                    ? <ActivityTimelineRow key={`d-${row.item.id}`} {...row.item} />
                    : <BucketEventHistoryRow key={`e-${row.item.event.id}`} item={row.item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}

interface DateGroup {
  label: string;
  rows: HistoryRow[];
}

function groupByDate(
  rows: HistoryRow[],
  labelFn: (iso: string) => string,
): DateGroup[] {
  const buckets = new Map<string, HistoryRow[]>();
  rows.forEach(row => {
    const key = row.at.slice(0, 10);
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  });
  return Array.from(buckets.entries()).map(([key, list]) => ({
    label: labelFn(`${key}T00:00:00`),
    rows: list,
  }));
}

/** Bucket transfer / remove row used inside the history modal date groups. */
function BucketEventHistoryRow({ item }: { item: ActivityHistoryBucketEventItem }) {
  const { copy, formatMoney, formatRelativeTime } = useI18n();
  const d = copy.dashboard;
  const event = item.event;
  const payload = event.payload as Record<string, unknown>;
  const pickString = (key: string): string | null => {
    const value = payload[key];
    return typeof value === 'string' && value.trim() ? value : null;
  };
  const isTransfer = event.event_key === 'bucket_transfer_created';
  const sourceName = pickString('source_bucket_name');
  const destinationName = pickString('destination_bucket_name');
  const bucketName = pickString('bucket_name') ?? sourceName;
  const description = isTransfer
    ? (sourceName && destinationName
        ? d.transferredBetweenBuckets(sourceName, destinationName)
        : d.transferredBetweenBucketsFallback)
    : (bucketName ? d.removedBucket(bucketName) : d.removedBucketFallback);
  const amountText = isTransfer && event.amount != null
    ? formatMoney(event.amount)
    : null;
  return (
    <div className="flex items-start gap-3 py-3">
      <IconBubble tone="muted" size="md">
        {isTransfer ? <IconArrowRight size={18} /> : <IconTrash size={18} />}
      </IconBubble>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-sm font-bold text-ink truncate">{item.actorName}</span>
          <span className="font-mono text-xs text-ink-muted shrink-0">{formatRelativeTime(event.created_at)}</span>
        </div>
        <p className="mt-0.5 font-mono text-xs text-ink-muted truncate">{description}</p>
      </div>
      {amountText && (
        <div className="shrink-0 font-mono text-sm font-bold text-ink-muted">
          {amountText}
        </div>
      )}
    </div>
  );
}
