import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { NotificationListItem } from '../components/Notifications/NotificationListItem';
import { useNotifications } from '../hooks/useNotifications';
import { notificationGroupLabel, resolveNotificationTarget } from '../lib/notifications';
import type { NotificationItem } from '../types';

type GroupKey = 'Today' | 'Yesterday' | 'Earlier';
const GROUP_ORDER: GroupKey[] = ['Today', 'Yesterday', 'Earlier'];

function groupNotifications(items: NotificationItem[]): Record<GroupKey, NotificationItem[]> {
  const groups: Record<GroupKey, NotificationItem[]> = { Today: [], Yesterday: [], Earlier: [] };
  for (const item of items) {
    groups[notificationGroupLabel(item.created_at)].push(item);
  }
  return groups;
}

export function Notifications() {
  const navigate = useNavigate();
  const { notifications, loading, error, refetch, markRead, markAllRead } = useNotifications();

  const groups = useMemo(() => groupNotifications(notifications), [notifications]);
  const hasUnread = notifications.some(item => !item.read_at);

  async function handleItemClick(item: NotificationItem) {
    const target = resolveNotificationTarget(item);
    if (!item.read_at) {
      // Optimistic mark-read — navigation proceeds even if the RPC
      // call lags so the tap stays snappy.
      void markRead(item.id);
    }
    navigate(target);
  }

  async function handleMarkAllRead() {
    if (!hasUnread) return;
    await markAllRead();
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <PageHeader
        eyebrow="Notifications"
        title="Updates"
        subtitle="From your project and reminders"
        showBack
      />

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/notifications/settings')}
          className="font-mono text-xs text-brand-800 underline-offset-2 hover:underline"
        >
          Notification settings
        </button>
        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="font-mono text-xs font-bold text-brand-800 hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      {loading && (
        <section className="flex flex-col gap-2" aria-label="Loading notifications">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </section>
      )}

      {!loading && error && (
        <section className="rounded-xl bg-surface p-5 shadow-soft">
          <SectionLabel tone="brand">Notifications</SectionLabel>
          <h2 className="mt-2 font-mono text-base font-bold text-ink">Could not load notifications</h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">{error}</p>
          <div className="mt-3">
            <Button variant="ghost" onClick={() => void refetch()}>Try again</Button>
          </div>
        </section>
      )}

      {!loading && !error && notifications.length === 0 && (
        <section className="rounded-xl bg-surface p-5 shadow-soft text-center">
          <SectionLabel tone="brand" className="text-center">Notifications</SectionLabel>
          <h2 className="mt-2 font-mono text-base font-bold text-ink">No notifications yet</h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            Updates from your project will show up here.
          </p>
          <div className="mt-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
          </div>
        </section>
      )}

      {!loading && !error && notifications.length > 0 && GROUP_ORDER.map(key => {
        const items = groups[key];
        if (items.length === 0) return null;
        return (
          <section key={key} className="flex flex-col gap-2">
            <SectionLabel tone="muted">{key}</SectionLabel>
            {items.map(item => (
              <NotificationListItem key={item.id} item={item} onClick={handleItemClick} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
