export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface PermissionStatusPillProps {
  permission: PushPermissionState;
  subscribed: boolean;
}

interface PillVisual {
  label: string;
  className: string;
}

function visualFor({ permission, subscribed }: PermissionStatusPillProps): PillVisual {
  if (permission === 'unsupported') {
    return { label: 'Unavailable', className: 'bg-well text-ink-muted' };
  }
  if (permission === 'denied') {
    return { label: 'Blocked', className: 'bg-danger-soft text-danger' };
  }
  if (permission === 'granted' && subscribed) {
    return { label: 'On this device', className: 'bg-brand-50 text-brand-800' };
  }
  if (permission === 'granted') {
    return { label: 'Permission on', className: 'bg-brand-50 text-brand-800' };
  }
  return { label: 'Needs permission', className: 'bg-well text-ink-muted' };
}

/**
 * Compact pill that translates browser permission + subscription
 * state into a single calm label. Used inside settings rows and
 * permission cards so the user can read their state at a glance.
 */
export function PermissionStatusPill(props: PermissionStatusPillProps) {
  const { label, className } = visualFor(props);
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-1 font-mono text-[11px] font-bold ${className}`}
    >
      {label}
    </span>
  );
}
