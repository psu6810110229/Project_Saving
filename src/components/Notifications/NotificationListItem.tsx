import { IconBubble } from '../IconBubble/IconBubble';
import {
  IconArrowRight,
  IconBell,
  IconCalendar,
  IconEdit,
  IconPiggyBank,
  IconTrash,
  IconTrendingUp,
  IconUser,
  IconVault,
} from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { notificationDisplayCopy } from '../../i18n/notificationCopy';
import { notificationIconKind } from '../../lib/notifications';
import type { NotificationItem } from '../../types';

interface NotificationListItemProps {
  item: NotificationItem;
  onClick: (item: NotificationItem) => void;
}

function iconFor(kind: ReturnType<typeof notificationIconKind>) {
  switch (kind) {
    case 'piggy': return <IconPiggyBank size={18} />;
    case 'calendar': return <IconCalendar size={18} />;
    case 'vault': return <IconVault size={18} />;
    case 'edit': return <IconEdit size={18} />;
    case 'user': return <IconUser size={18} />;
    case 'trend': return <IconTrendingUp size={18} />;
    case 'transfer': return <IconArrowRight size={18} />;
    case 'remove': return <IconTrash size={18} />;
    case 'bell':
    default:
      return <IconBell size={18} />;
  }
}

/**
 * One tappable row in the notification center. Unread items get a
 * dot marker and a slightly warmer background; read items stay calm.
 * The dot space is reserved on read items so marking-read does not
 * cause layout shift.
 */
export function NotificationListItem({ item, onClick }: NotificationListItemProps) {
  const { copy, formatMoney, formatRelativeTime } = useI18n();
  const unread = !item.read_at;
  const kind = notificationIconKind(item.event_key);
  const display = notificationDisplayCopy(item, copy, formatMoney);
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={
        'w-full flex items-start gap-3 rounded-xl shadow-soft p-3 text-left active:scale-[0.99] transition-transform '
        + (unread ? 'bg-brand-50/60' : 'bg-surface')
      }
      aria-label={`${unread ? copy.notifications.center.unreadAriaPrefix : ''}${display.title}. ${display.body}`}
    >
      <IconBubble tone={unread ? 'peach' : 'muted'} size="md">
        {iconFor(kind)}
      </IconBubble>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className={`font-mono text-sm ${unread ? 'font-bold text-ink' : 'font-bold text-ink'} truncate`}>
            {display.title}
          </p>
        </div>
        <p className="mt-0.5 font-mono text-xs text-ink-muted line-clamp-2">
          {display.body}
        </p>
        <p className="mt-1 font-mono text-[11px] text-ink-muted" title={item.created_at}>
          {formatRelativeTime(item.created_at)}
        </p>
      </div>
      <span
        className={
          'mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 '
          + (unread ? 'bg-brand-500' : 'bg-transparent')
        }
        aria-hidden
      />
    </button>
  );
}
