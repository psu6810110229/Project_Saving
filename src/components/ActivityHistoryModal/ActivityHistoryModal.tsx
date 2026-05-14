import { useMemo, useState } from 'react';
import { ActivityTimelineRow } from '../ActivityTimelineRow/ActivityTimelineRow';
import { FormField } from '../FormField/FormField';
import { Modal } from '../Modal/Modal';
import { Segmented } from '../Segmented/Segmented';
import { TextInput } from '../TextInput/TextInput';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';

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

interface ActivityHistoryModalProps {
  open: boolean;
  onClose: () => void;
  items: ActivityHistoryItem[];
}

type SortOrder = 'newest' | 'oldest' | 'largest';

const SORT_STORAGE_KEY = 'activity-history:sort';

/**
 * Full activity history modal opened from the "View more" button on
 * the Dashboard's recent-activity feed. Groups deposits by date,
 * supports a free-text search across actor + bucket names + amount,
 * and offers three sort orders (newest / oldest / largest amount).
 *
 * Sort preference persists per browser via localStorage so opening
 * the modal again restores the previously-used sort. Search resets
 * on each open intentionally — it's a quick scan tool, not a saved
 * filter.
 */
export function ActivityHistoryModal({ open, onClose, items }: ActivityHistoryModalProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useLocalStorageState<SortOrder>(SORT_STORAGE_KEY, 'newest');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? items.filter(item => (
        item.actorName.toLowerCase().includes(q)
          || item.bucketName.toLowerCase().includes(q)
          || String(item.amount).includes(q)
      ))
      : items;
    const sorted = [...matches];
    if (sort === 'newest') sorted.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    if (sort === 'oldest') sorted.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    if (sort === 'largest') sorted.sort((a, b) => b.amount - a.amount);
    return sorted;
  }, [items, query, sort]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <Modal open={open} title="Activity History" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <FormField label="Search">
          <TextInput
            value={query}
            placeholder="Name, bucket, or amount"
            onChange={event => setQuery(event.target.value)}
          />
        </FormField>
        <div className="flex justify-end">
          <Segmented<SortOrder>
            ariaLabel="Sort activity history"
            options={[
              { value: 'newest', label: 'Newest' },
              { value: 'oldest', label: 'Oldest' },
              { value: 'largest', label: 'Largest' },
            ]}
            value={sort}
            onChange={setSort}
          />
        </div>
        {grouped.length === 0 && (
          <p className="rounded-lg bg-well px-4 py-3 font-mono text-xs text-ink-muted">
            {query ? 'No deposits match this search.' : 'No deposits yet.'}
          </p>
        )}
        <div className="flex flex-col gap-3 max-h-[60dvh] overflow-y-auto">
          {grouped.map(group => (
            <section key={group.label}>
              <h3 className="sticky top-0 z-10 bg-surface py-1 font-mono text-[11px] uppercase tracking-wider text-ink-muted">
                {group.label}
              </h3>
              <div className="rounded-lg bg-well/40 px-3 divide-y divide-well">
                {group.items.map(item => (
                  <ActivityTimelineRow key={item.id} {...item} />
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
  items: ActivityHistoryItem[];
}

function groupByDate(items: ActivityHistoryItem[]): DateGroup[] {
  const buckets = new Map<string, ActivityHistoryItem[]>();
  items.forEach(item => {
    const key = item.occurredAt.slice(0, 10);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  });
  const today = new Date().toISOString().slice(0, 10);
  return Array.from(buckets.entries()).map(([key, list]) => ({
    label: humanLabel(key, today),
    items: list,
  }));
}

function humanLabel(key: string, today: string): string {
  if (key === today) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.toISOString().slice(0, 10) === key) return 'Yesterday';
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
