import { useState } from 'react';
import { Button } from '../components/Button/Button';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { NotificationToggle } from '../components/Notifications/NotificationToggle';
import {
  PermissionStatusPill,
  type PushPermissionState,
} from '../components/Notifications/PermissionStatusPill';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { NOTIFICATION_CATEGORY_COPY } from '../lib/notifications';
import type { NotificationPreferencesUpdate } from '../types';

function toPillState(
  permission: NotificationPermission | 'unsupported',
): PushPermissionState {
  if (permission === 'unsupported') return 'unsupported';
  if (permission === 'granted' || permission === 'denied') return permission;
  return 'default';
}

export function NotificationSettings() {
  const { preferences, loading, saving, error, update } = useNotificationPreferences();
  const { ready, subscribed, unsupported, permission: rawPermission, subscribe, unsubscribe } = usePushSubscription();
  const permission = toPillState(rawPermission);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState<string | null>(null);

  async function applyChange(changes: NotificationPreferencesUpdate) {
    await update(changes);
  }

  async function handleEnableDevice() {
    setDeviceBusy(true);
    setDeviceMessage(null);
    const result = await subscribe();
    setDeviceBusy(false);
    if (result.error) {
      setDeviceMessage(result.error);
      return;
    }
    // Subscribing implies the user wants push: turn the push prefs on
    // so categories actually deliver. master/nudges/partner stay as-is.
    await update({ push_enabled: true });
    setDeviceMessage('This device can now receive push notifications.');
  }

  async function handleDisableDevice() {
    setDeviceBusy(true);
    setDeviceMessage(null);
    const result = await unsubscribe();
    setDeviceBusy(false);
    if (result.error) {
      setDeviceMessage(result.error);
      return;
    }
    setDeviceMessage('Push is off for this device. In-app updates still work.');
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 pb-24">
        <PageHeader eyebrow="Profile" title="Notifications" subtitle="Push and in-app" showBack />
        <div className="flex flex-col gap-2" aria-label="Loading notification settings">
          <Skeleton className="h-20" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
    );
  }

  if (error || !preferences) {
    return (
      <div className="flex flex-col gap-6 pb-24">
        <PageHeader eyebrow="Profile" title="Notifications" subtitle="Push and in-app" showBack />
        <section className="rounded-xl bg-surface p-5 shadow-soft">
          <SectionLabel tone="brand">Notifications</SectionLabel>
          <h2 className="mt-2 font-mono text-base font-bold text-ink">Could not load notification settings</h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">{error ?? 'Try again in a moment.'}</p>
        </section>
      </div>
    );
  }

  const master = preferences.master_enabled;
  const categoryDisabled = !master;
  const showEnableDeviceCta = !unsupported && permission !== 'denied' && !subscribed;
  const showDisableDeviceCta = !unsupported && subscribed;

  return (
    <div className="flex flex-col gap-6 pb-24">
      <PageHeader eyebrow="Profile" title="Notifications" subtitle="Push and in-app" showBack />

      {/* Push / device status card. Separate from category toggles so the
          user can tell push-permission state from preference state. */}
      <section className="rounded-xl bg-surface p-4 shadow-soft flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SectionLabel tone="brand">This device</SectionLabel>
            <h2 className="mt-1 font-mono text-base font-bold text-ink">Push permission</h2>
            <p className="mt-1 font-mono text-xs text-ink-muted">
              {permission === 'denied'
                ? 'Enable notifications in your browser settings to receive push updates on this device.'
                : permission === 'unsupported'
                  ? 'This browser cannot receive GO-OUT push notifications. In-app updates still appear here.'
                  : subscribed
                    ? 'This device can receive push notifications.'
                    : 'Push is off on this device. In-app notifications still work.'}
            </p>
          </div>
          <PermissionStatusPill permission={permission} subscribed={subscribed} />
        </div>
        {showEnableDeviceCta && (
          <Button variant="primary" onClick={handleEnableDevice} disabled={deviceBusy || !ready}>
            {deviceBusy ? 'Enabling…' : 'Enable this device'}
          </Button>
        )}
        {showDisableDeviceCta && (
          <Button variant="ghost" onClick={handleDisableDevice} disabled={deviceBusy}>
            {deviceBusy ? 'Turning off…' : 'Turn off this device'}
          </Button>
        )}
        {deviceMessage && (
          <p className="font-mono text-[11px] text-ink-muted">{deviceMessage}</p>
        )}
      </section>

      {/* Master switch. Turning off does not delete history; it only
          mutes future deliveries. */}
      <section className="flex flex-col gap-2">
        <SectionLabel tone="brand">Master</SectionLabel>
        <NotificationToggle
          checked={master}
          label="Notifications"
          description={master
            ? 'Nudges, reminders, and partner updates can appear here.'
            : 'All notification categories are off.'}
          disabled={saving}
          onChange={next => applyChange({ master_enabled: next })}
        />
      </section>

      {/* Per-category toggles. Disabled (not hidden) when master is off
          so the user can see what would resume on re-enable. */}
      <section className="flex flex-col gap-2">
        <SectionLabel tone="brand">Categories</SectionLabel>
        <NotificationToggle
          checked={preferences.nudges_enabled}
          label={NOTIFICATION_CATEGORY_COPY.nudges.label}
          description={NOTIFICATION_CATEGORY_COPY.nudges.description}
          disabled={categoryDisabled || saving}
          onChange={next => applyChange({ nudges_enabled: next })}
        />
        <NotificationToggle
          checked={preferences.saving_reminders_enabled}
          label={NOTIFICATION_CATEGORY_COPY.saving_reminders.label}
          description={NOTIFICATION_CATEGORY_COPY.saving_reminders.description}
          disabled={categoryDisabled || saving}
          onChange={next => applyChange({ saving_reminders_enabled: next })}
        />
        <NotificationToggle
          checked={preferences.partner_activity_enabled}
          label={NOTIFICATION_CATEGORY_COPY.partner_activity.label}
          description={NOTIFICATION_CATEGORY_COPY.partner_activity.description}
          disabled={categoryDisabled || saving}
          onChange={next => applyChange({ partner_activity_enabled: next })}
        />
        <NotificationToggle
          checked={preferences.product_updates_enabled}
          label={NOTIFICATION_CATEGORY_COPY.product_updates.label}
          description={NOTIFICATION_CATEGORY_COPY.product_updates.description}
          disabled={categoryDisabled || saving}
          onChange={next => applyChange({ product_updates_enabled: next })}
        />
      </section>

      {saving && (
        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-muted">
          <Spinner size="sm" /> Saving…
        </div>
      )}
    </div>
  );
}
