import { useI18n } from '../../i18n/useI18n';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface PermissionStatusPillProps {
  permission: PushPermissionState;
  subscribed: boolean;
}

interface PillVisual {
  label: string;
  className: string;
}

function visualFor(
  { permission, subscribed }: PermissionStatusPillProps,
  labels: {
    unavailable: string;
    blocked: string;
    onThisDevice: string;
    permissionOn: string;
    needsPermission: string;
  },
): PillVisual {
  if (permission === 'unsupported') {
    return { label: labels.unavailable, className: 'bg-well text-ink-muted' };
  }
  if (permission === 'denied') {
    return { label: labels.blocked, className: 'bg-danger-soft text-danger' };
  }
  if (permission === 'granted' && subscribed) {
    return { label: labels.onThisDevice, className: 'bg-brand-50 text-brand-800' };
  }
  if (permission === 'granted') {
    return { label: labels.permissionOn, className: 'bg-brand-50 text-brand-800' };
  }
  return { label: labels.needsPermission, className: 'bg-well text-ink-muted' };
}

/**
 * Compact pill that translates browser permission + subscription
 * state into a single calm label. Used inside settings rows and
 * permission cards so the user can read their state at a glance.
 */
export function PermissionStatusPill(props: PermissionStatusPillProps) {
  const { copy } = useI18n();
  const { label, className } = visualFor(props, copy.notifications.permission);
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-1 font-mono text-[11px] font-bold ${className}`}
    >
      {label}
    </span>
  );
}
