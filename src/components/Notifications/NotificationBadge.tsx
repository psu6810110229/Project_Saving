interface NotificationBadgeProps {
  count: number;
  max?: number;
  size?: 'sm' | 'md';
  /** When true the badge becomes decorative — assume the parent button label exposes the count. */
  decorative?: boolean;
}

/**
 * Small red-orange unread badge used by the Dashboard bell and the
 * Profile notifications row. Hidden when count is 0 so it never
 * implies a fake update.
 */
export function NotificationBadge({ count, max = 9, size = 'sm', decorative = false }: NotificationBadgeProps) {
  if (!count || count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);
  const dimension = size === 'sm' ? 'min-w-[16px] h-4 text-[10px] px-1' : 'min-w-[20px] h-5 text-[11px] px-1.5';
  return (
    <span
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${count} unread notifications`}
      className={
        `inline-flex items-center justify-center rounded-full bg-brand-500 text-ink-inverse font-mono font-bold ${dimension}`
      }
    >
      {label}
    </span>
  );
}
