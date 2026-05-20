import { Avatar } from '../Avatar/Avatar';
import { Chip } from '../Chip/Chip';
import type { ThemeSwatch } from '../../lib/theme';

/**
 * Compact row used inside Manage Project's Members section. Renders
 * one member's avatar, display name (with optional "(You)" suffix),
 * joined-date label, and an optional "Creator" chip in the trailing
 * meta slot.
 *
 * Intentionally non-interactive in v1: there is no `onClick`, no
 * chevron, and no `<button>` wrapper. Member detail navigation is a
 * follow-up task. The visual language matches `SettingsRow` (surface
 * bg, soft shadow, lg radius, p-3 padding) so the row sits cleanly
 * inside the existing settings stack.
 */

interface RoomMemberRowProps {
  name: string;
  fallback: string;
  imageUrl?: string | null;
  themeColor?: ThemeSwatch;
  joinedDateLabel: string;
  isYou: boolean;
  isCreator: boolean;
  creatorBadgeLabel: string;
  youSuffix?: string;
}

export function RoomMemberRow({
  name,
  fallback,
  imageUrl,
  themeColor,
  joinedDateLabel,
  isYou,
  isCreator,
  creatorBadgeLabel,
  youSuffix,
}: RoomMemberRowProps) {
  const primary = isYou && youSuffix ? youSuffix : name;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface p-3 shadow-soft">
      <Avatar
        size="md"
        imageUrl={imageUrl}
        fallback={fallback}
        themeColor={themeColor}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="copy-allowed truncate font-mono text-sm font-bold text-ink">
          {primary}
        </span>
        <span className="truncate font-mono text-xs text-ink-muted">
          {joinedDateLabel}
        </span>
      </div>
      {isCreator && (
        <div className="shrink-0">
          <Chip tone="peach">{creatorBadgeLabel}</Chip>
        </div>
      )}
    </div>
  );
}
