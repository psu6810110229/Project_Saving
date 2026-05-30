import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { NotificationListItem } from '../components/Notifications/NotificationListItem';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useNotifications } from '../hooks/useNotifications';
import { useI18n } from '../i18n/useI18n';
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
  const { copy } = useI18n();
  const n = copy.notifications;

  const groups = useMemo(() => groupNotifications(notifications), [notifications]);
  const hasUnread = notifications.some(item => !item.read_at);
  const { shouldShowLoader: shouldShowSkeleton } = useLoadingGate({
    loading,
    showAfterMs: 120,
    minimumVisibleMs: 400,
  });

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
    <div className="flex flex-col gap-6 px-5 pt-8 pb-24">
      <PageHeader
        eyebrow={n.center.eyebrow}
        title={n.center.title}
        subtitle={n.center.subtitle}
        showBack
      />

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/notifications/settings')}
          className="font-mono text-xs text-brand-800 underline-offset-2 hover:underline"
        >
          {n.center.settingsLink}
        </button>
        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="font-mono text-xs font-bold text-brand-800 hover:underline"
          >
            {n.center.markAllRead}
          </button>
        )}
      </div>

      {loading && shouldShowSkeleton && (
        <section className="flex flex-col gap-3" aria-label={n.center.loadingAriaLabel}>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-24 rounded-pill" />
            <Spinner size="sm" tone="neutral" />
          </div>
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </section>
      )}

      {!loading && error && (
        <section className="rounded-xl bg-surface p-5 shadow-soft">
          <SectionLabel tone="brand">{n.center.errorSection}</SectionLabel>
          <h2 className="mt-2 font-mono text-base font-bold text-ink">{n.center.errorTitle}</h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">{error}</p>
          <div className="mt-3">
            <Button variant="ghost" onClick={() => void refetch()}>{copy.common.retry}</Button>
          </div>
        </section>
      )}

      {!loading && !error && notifications.length === 0 && (
        <section className="rounded-xl bg-surface p-5 shadow-soft text-center">
          <SectionLabel tone="brand" className="text-center">{n.center.emptySection}</SectionLabel>
          <h2 className="mt-2 font-mono text-base font-bold text-ink">{n.center.emptyTitle}</h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {n.center.emptyBody}
          </p>
          <div className="mt-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>{n.center.backToDashboard}</Button>
          </div>
        </section>
      )}

      {!loading && !error && notifications.length > 0 && GROUP_ORDER.map(key => {
        const items = groups[key];
        if (items.length === 0) return null;
        return (
          <section key={key} className="flex flex-col gap-2">
            <SectionLabel tone="muted">{n.groups[key]}</SectionLabel>
            {items.map(item => (
              <NotificationListItem key={item.id} item={item} onClick={handleItemClick} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
