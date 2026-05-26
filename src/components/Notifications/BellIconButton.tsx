import { IconBell } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { useI18n } from '../../i18n/useI18n';
import { NotificationBadge } from './NotificationBadge';

interface BellIconButtonProps {
  unreadCount: number;
  onClick: () => void;
  disabled?: boolean;
}

export function BellIconButton({ unreadCount, onClick, disabled }: BellIconButtonProps) {
  const { copy } = useI18n();
  const count = Math.max(0, unreadCount);
  const label = copy.notifications.center.bellAria(count);
  return (
    <IconButton
      variant="ghost"
      size="md"
      ariaLabel={label}
      onClick={onClick}
      disabled={disabled}
      className="relative"
    >
      <>
        <IconBell size={20} />
        {count > 0 && (
          <span className="pointer-events-none absolute -top-0.5 -right-0.5">
            <NotificationBadge count={count} decorative />
          </span>
        )}
      </>
    </IconButton>
  );
}
