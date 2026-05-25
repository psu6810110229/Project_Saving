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
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { usePushSubscription } from '../hooks/usePushSubscription';
import { useI18n } from '../i18n/useI18n';
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
  const { copy } = useI18n();
  const n = copy.notifications;
  const permission = toPillState(rawPermission);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState<string | null>(null);
  const { shouldShowLoader: shouldShowSkeleton } = useLoadingGate({
    loading,
    showAfterMs: 120,
    minimumVisibleMs: 400,
  });

  function localizeDeviceError(message: string | undefined): string {
    switch (message) {
      case 'Push not supported in this browser.':
        return n.permission.subscribeNotSupported;
      case 'Push is not configured for this deployment.':
        return n.permission.subscribeNotConfigured;
      case 'Notifications were not allowed.':
        return n.permission.subscribeNotAllowed;
      case 'Could not read the push subscription details.':
        return n.permission.subscriptionReadError;
      case 'Not authenticated':
        return n.permission.notAuthenticated;
      default:
        return message ?? copy.common.somethingWrong;
    }
  }

  async function applyChange(changes: NotificationPreferencesUpdate) {
    await update(changes);
  }

  async function handleEnableDevice() {
    setDeviceBusy(true);
    setDeviceMessage(null);
    const result = await subscribe();
    setDeviceBusy(false);
    if (result.error) {
      setDeviceMessage(localizeDeviceError(result.error));
      return;
    }
    // Subscribing implies the user wants push: turn the push prefs on
    // so categories actually deliver. master/nudges/partner stay as-is.
    await update({ push_enabled: true });
    setDeviceMessage(n.permission.enabledMessage);
  }

  async function handleDisableDevice() {
    setDeviceBusy(true);
    setDeviceMessage(null);
    const result = await unsubscribe();
    setDeviceBusy(false);
    if (result.error) {
      setDeviceMessage(localizeDeviceError(result.error));
      return;
    }
    setDeviceMessage(n.permission.disabledMessage);
  }

  if (loading && shouldShowSkeleton) {
    return (
      <div className="flex flex-col gap-6 pt-8 pb-24">
        <PageHeader eyebrow={n.settings.eyebrow} title={n.settings.title} subtitle={n.settings.subtitle} showBack />
        <div className="flex flex-col gap-3" aria-label={n.settings.loadingAriaLabel}>
          <div className="flex items-center justify-end">
            <Spinner size="sm" tone="neutral" />
          </div>
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      </div>
    );
  }
  if (loading) return null;

  if (error || !preferences) {
    return (
      <div className="flex flex-col gap-6 pt-8 pb-24">
        <PageHeader eyebrow={n.settings.eyebrow} title={n.settings.title} subtitle={n.settings.subtitle} showBack />
        <section className="rounded-xl bg-surface p-5 shadow-soft">
          <SectionLabel tone="brand">{n.settings.errorSection}</SectionLabel>
          <h2 className="mt-2 font-mono text-base font-bold text-ink">{n.settings.errorTitle}</h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">{error ?? n.settings.errorFallback}</p>
        </section>
      </div>
    );
  }

  const master = preferences.master_enabled;
  const categoryDisabled = !master;
  const showEnableDeviceCta = !unsupported && permission !== 'denied' && !subscribed;
  const showDisableDeviceCta = !unsupported && subscribed;

  return (
    <div className="flex flex-col gap-6 pt-8 pb-24">
      <PageHeader eyebrow={n.settings.eyebrow} title={n.settings.title} subtitle={n.settings.subtitle} showBack />

      {/* Push / device status card. Separate from category toggles so the
          user can tell push-permission state from preference state. */}
      <section className="rounded-xl bg-surface p-4 shadow-soft flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SectionLabel tone="brand">{n.settings.deviceSection}</SectionLabel>
            <h2 className="mt-1 font-mono text-base font-bold text-ink">{n.settings.permissionTitle}</h2>
            <p className="mt-1 font-mono text-xs text-ink-muted">
              {permission === 'denied'
                ? n.permission.deniedBody
                : permission === 'unsupported'
                  ? n.permission.unsupportedBody
                  : subscribed
                    ? n.permission.subscribedBody
                    : n.permission.offBody}
            </p>
          </div>
          <PermissionStatusPill permission={permission} subscribed={subscribed} />
        </div>
        {showEnableDeviceCta && (
          <Button variant="primary" onClick={handleEnableDevice} disabled={deviceBusy || !ready}>
            {deviceBusy ? n.permission.enablingButton : n.permission.enableButton}
          </Button>
        )}
        {showDisableDeviceCta && (
          <Button variant="ghost" onClick={handleDisableDevice} disabled={deviceBusy}>
            {deviceBusy ? n.permission.disablingButton : n.permission.disableButton}
          </Button>
        )}
        {deviceMessage && (
          <p className="font-mono text-[11px] text-ink-muted">{deviceMessage}</p>
        )}
      </section>

      {/* Master switch. Turning off does not delete history; it only
          mutes future deliveries. */}
      <section className="flex flex-col gap-2">
        <SectionLabel tone="brand">{n.settings.masterSection}</SectionLabel>
        <NotificationToggle
          checked={master}
          label={n.settings.masterLabel}
          description={master
            ? n.settings.masterOnDescription
            : n.settings.masterOffDescription}
          disabled={saving}
          onChange={next => applyChange({ master_enabled: next })}
        />
      </section>

      {/* Per-category toggles. Disabled (not hidden) when master is off
          so the user can see what would resume on re-enable. */}
      <section className="flex flex-col gap-2">
        <SectionLabel tone="brand">{n.settings.categoriesSection}</SectionLabel>
        <NotificationToggle
          checked={preferences.nudges_enabled}
          label={n.categories.toggles.nudges.label}
          description={n.categories.toggles.nudges.description}
          disabled={categoryDisabled || saving}
          onChange={next => applyChange({ nudges_enabled: next })}
        />
        <NotificationToggle
          checked={preferences.saving_reminders_enabled}
          label={n.categories.toggles.saving_reminders.label}
          description={n.categories.toggles.saving_reminders.description}
          disabled={categoryDisabled || saving}
          onChange={next => applyChange({ saving_reminders_enabled: next })}
        />
        <NotificationToggle
          checked={preferences.partner_activity_enabled}
          label={n.categories.toggles.partner_activity.label}
          description={n.categories.toggles.partner_activity.description}
          disabled={categoryDisabled || saving}
          onChange={next => applyChange({ partner_activity_enabled: next })}
        />
        <NotificationToggle
          checked={preferences.product_updates_enabled}
          label={n.categories.toggles.product_updates.label}
          description={n.categories.toggles.product_updates.description}
          disabled={categoryDisabled || saving}
          onChange={next => applyChange({ product_updates_enabled: next })}
        />
      </section>

      {saving && (
        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-muted">
          <Spinner size="sm" tone="neutral" /> {n.settings.savingStatus}
        </div>
      )}

      {/* Quiet, calm reassurance that history persists even when
          everything is off. Removes the most common confusion about
          the master toggle without adding new controls. */}
      <p className="font-mono text-[11px] text-ink-muted leading-relaxed">
        {n.settings.historyNote}
      </p>
    </div>
  );
}
