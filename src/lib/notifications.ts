import type { NotificationEventKey, NotificationItem } from '../types';

/**
 * Allowed top-level route prefixes for in-app notification taps. The
 * service worker uses the same allow-list to sanitize push payload
 * URLs — keep these in sync if you add a new route in `App.tsx`.
 */
const ALLOWED_ROUTE_PREFIXES = [
  '/dashboard',
  '/add',
  '/saving-plan',
  '/manage-project',
  '/notifications',
  '/profile',
];

function isValidRoute(route: string | null | undefined): route is string {
  if (!route) return false;
  if (!route.startsWith('/')) return false;
  if (route.startsWith('//')) return false;
  return ALLOWED_ROUTE_PREFIXES.some(prefix =>
    route === prefix || route.startsWith(`${prefix}?`) || route.startsWith(`${prefix}/`)
  );
}

/**
 * Resolves the in-app tap target for a notification. Falls back to
 * `fallback_route` (and ultimately `/dashboard`) when the primary
 * target is missing or unsupported, so a tap can never land the user
 * on a dead route.
 */
export function resolveNotificationTarget(item: Pick<NotificationItem, 'target_route' | 'target_section' | 'fallback_route'>): string {
  const primary = isValidRoute(item.target_route) ? item.target_route : null;
  const fallback = isValidRoute(item.fallback_route) ? item.fallback_route : '/dashboard';
  return primary ?? fallback;
}

/** Calm, neutral category labels used by chips in the notification list. */
export const NOTIFICATION_CATEGORY_LABEL: Record<string, string> = {
  nudge: 'Nudge',
  saving_reminder: 'Reminder',
  partner_activity: 'Partner',
  product: 'Update',
};

/** Display copy for category toggle rows in Notification Settings. */
export const NOTIFICATION_CATEGORY_COPY = {
  nudges: {
    label: 'Nudges',
    description: 'When your partner sends a nudge.',
  },
  saving_reminders: {
    label: 'Saving reminders',
    description: 'Quiet reminders for your active Saving Plan.',
  },
  partner_activity: {
    label: 'Partner activity',
    description: 'Deposits and project updates from your partner.',
  },
  product_updates: {
    label: 'Product updates',
    description: 'Occasional updates about new features.',
  },
} as const;

/**
 * Maps an event key to a UX icon family. The NotificationListItem
 * keeps its own concrete icon mapping; this string is exposed for
 * components that want to vary tone or analytics later.
 */
export function notificationIconKind(eventKey: NotificationEventKey | string): 'bell' | 'piggy' | 'calendar' | 'vault' | 'edit' | 'user' | 'trend' | 'transfer' | 'remove' {
  switch (eventKey) {
    case 'nudge_received':
      return 'bell';
    case 'partner_deposited':
    case 'bucket_added':
    case 'bucket_updated':
    case 'bucket_goal_reached':
      return 'piggy';
    case 'bucket_transferred':
      return 'transfer';
    case 'bucket_removed':
      return 'remove';
    case 'saving_reminder_due':
    case 'plan_changed':
    case 'plan_paused':
    case 'plan_resumed':
    case 'plan_created':
    case 'plan_started':
      return 'calendar';
    case 'balance_checked':
    case 'goal_reached':
      return 'vault';
    case 'goal_changed':
      return 'edit';
    case 'room_joined':
    case 'room_left':
      return 'user';
    case 'overtaking':
    case 'streak_milestone':
      return 'trend';
    default:
      return 'bell';
  }
}

/** Bangkok-agnostic date grouping for the notification center. */
export function notificationGroupLabel(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const created = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(created, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(created, yesterday)) return 'Yesterday';
  return 'Earlier';
}
