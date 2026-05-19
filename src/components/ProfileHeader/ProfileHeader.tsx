import type { ThemeSwatch } from '../../lib/theme';
import { Avatar } from '../Avatar/Avatar';
import { Chip } from '../Chip/Chip';
import { IconEdit } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { useI18n } from '../../i18n/useI18n';

interface ProfileHeaderProps {
  name: string;
  fallback: string;
  avatarUrl?: string | null;
  memberLabel: string;
  themeColor?: ThemeSwatch;
  onEdit: () => void;
}

export function ProfileHeader({
  name,
  fallback,
  avatarUrl,
  memberLabel,
  themeColor,
  onEdit,
}: ProfileHeaderProps) {
  const { copy } = useI18n();
  return (
    <section className="rounded-xl bg-surface shadow-soft p-5 flex items-center gap-4">
      <Avatar size="lg" fallback={fallback} imageUrl={avatarUrl} ring="theme" themeColor={themeColor} />
      <div className="flex-1 min-w-0">
        <h2 className="truncate font-mono text-xl font-bold leading-tight text-ink">{name}</h2>
        <div className="mt-2">
          <Chip tone="peach">{memberLabel}</Chip>
        </div>
      </div>
      <IconButton ariaLabel={copy.profile.editProfileLabel} onClick={onEdit}>
        <IconEdit size={18} />
      </IconButton>
    </section>
  );
}
