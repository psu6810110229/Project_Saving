import type { Messages } from './messages';
import type { NotificationItem } from '../types';

interface LocalizedNotificationCopy {
  title: string;
  body: string;
  ctaLabel: string | null;
}

type EventCopy = {
  title: string;
  body: string;
  ctaLabel?: string;
};

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function payloadNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function actorName(payload: Record<string, unknown>, fallback: string): string {
  return payloadString(payload, 'actor_name') ?? payloadString(payload, 'sender_name') ?? fallback;
}

function withStoredFallback(item: NotificationItem, eventCopy: EventCopy | null): LocalizedNotificationCopy {
  return {
    title: eventCopy?.title ?? item.title,
    body: eventCopy?.body ?? item.body,
    ctaLabel: eventCopy?.ctaLabel ?? item.cta_label,
  };
}

export function notificationDisplayCopy(
  item: NotificationItem,
  copy: Messages,
  formatMoney: (amount: number) => string,
): LocalizedNotificationCopy {
  const payload = item.payload ?? {};
  const n = copy.notifications;
  const fallbackPartner = n.nudge.fallbackPartner;

  switch (item.event_key) {
    case 'nudge_received':
      return withStoredFallback(item, n.events.nudgeReceived(actorName(payload, fallbackPartner)));
    case 'saving_reminder_due':
      return withStoredFallback(item, n.events.savingReminderDue());
    case 'partner_deposited': {
      const amount = payloadNumber(payload, 'amount');
      return withStoredFallback(
        item,
        amount == null ? null : n.events.partnerDeposited(
          actorName(payload, fallbackPartner),
          formatMoney(amount),
          payloadString(payload, 'bucket_name'),
        ),
      );
    }
    case 'balance_checked':
      return withStoredFallback(item, n.events.balanceChecked(actorName(payload, fallbackPartner)));
    case 'plan_created':
      return withStoredFallback(item, n.events.planCreated(actorName(payload, fallbackPartner)));
    case 'plan_changed':
      return withStoredFallback(item, n.events.planChanged(actorName(payload, fallbackPartner)));
    case 'plan_paused':
      return withStoredFallback(item, n.events.planPaused(actorName(payload, fallbackPartner)));
    case 'plan_resumed':
      return withStoredFallback(item, n.events.planResumed(actorName(payload, fallbackPartner)));
    case 'goal_changed':
      return withStoredFallback(item, n.events.goalChanged(actorName(payload, fallbackPartner)));
    case 'bucket_added':
      return withStoredFallback(
        item,
        n.events.bucketAdded(actorName(payload, fallbackPartner), payloadString(payload, 'bucket_name')),
      );
    case 'bucket_updated':
      return withStoredFallback(
        item,
        n.events.bucketUpdated(actorName(payload, fallbackPartner), payloadString(payload, 'bucket_name')),
      );
    case 'room_joined':
      return withStoredFallback(
        item,
        n.events.roomJoined(actorName(payload, fallbackPartner), payloadString(payload, 'room_name')),
      );
    case 'room_left':
      return withStoredFallback(
        item,
        n.events.roomLeft(actorName(payload, fallbackPartner), payloadString(payload, 'room_name')),
      );
    case 'bucket_goal_reached':
      return withStoredFallback(item, n.events.bucketGoalReached(payloadString(payload, 'bucket_name')));
    case 'overtaking':
      return withStoredFallback(item, n.events.overtaking(actorName(payload, fallbackPartner)));
    case 'streak_milestone': {
      const days = payloadNumber(payload, 'streak');
      return withStoredFallback(item, days == null ? null : n.events.streakMilestone(days));
    }
    case 'goal_reached':
      return withStoredFallback(item, n.events.goalReached());
    default:
      return withStoredFallback(item, null);
  }
}
