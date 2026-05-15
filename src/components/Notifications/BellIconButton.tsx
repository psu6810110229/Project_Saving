import { IconBell } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { NotificationBadge } from './NotificationBadge';

interface BellIconButtonProps {
  unreadCount: number;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Bell entry point that opens the in-app notification center. Pairs
 * with `NotificationBadge` for the unread indicator. The badge is
 * decorative — accessible count lives in `aria-label` to avoid double
 * announcements.
 */
export function BellIconButton({ unreadCount, onClick, disabled }: BellIconButtonProps) {
  const { copy } = useI18n();
  const count = Math.max(0, unreadCount);
  const label = copy.notifications.center.bellAria(count);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 text-ink hover:bg-brand-100 active:scale-[0.96] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <IconBell size={20} />
      {count > 0 && (
        <span className="pointer-events-none absolute -top-0.5 -right-0.5">
          <NotificationBadge count={count} decorative />
        </span>
      )}
    </button>
  );
}
