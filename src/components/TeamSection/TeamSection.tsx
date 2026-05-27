import { memo } from 'react';
import { Avatar } from '../Avatar/Avatar';
import { Button } from '../Button/Button';
import { IconArrowRight, IconUser } from '../Icon/Icon';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';
import { themeSwatches, type ThemeSwatch } from '../../lib/theme';

export interface TeamSectionMember {
  userId: string;
  name: string;
  fallback: string;
  imageUrl?: string | null;
  saved: number;
  target: number;
  themeColor?: ThemeSwatch;
  isYou: boolean;
}

interface TeamSectionProps {
  members: TeamSectionMember[];
  roomSaved: number;
  roomTarget: number;
  emptyBody?: string;
  onMemberClick: (member: TeamSectionMember) => void;
  onViewAll: () => void;
}

export const TeamSection = memo(function TeamSection({
  members,
  roomSaved,
  roomTarget,
  emptyBody,
  onMemberClick,
  onViewAll,
}: TeamSectionProps) {
  const sorted = [...members].sort((a, b) => {
    const pctDelta = memberPct(b) - memberPct(a);
    if (pctDelta !== 0) return pctDelta;
    if (b.saved !== a.saved) return b.saved - a.saved;
    return a.name.localeCompare(b.name);
  });
  const visible = sorted.slice(0, 3);
  const moreCount = Math.max(0, sorted.length - visible.length);
  const roomPct = roomTarget > 0 ? Math.min(100, (roomSaved / roomTarget) * 100) : 0;

  return (
    <section className="rounded-xl bg-surface p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-mono text-lg font-bold leading-tight text-ink">Team</h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            Room: <span className="font-bold text-brand-800">{Math.round(roomPct)}%</span>
          </p>
        </div>
        <div className="min-w-[7rem] max-w-[9rem] flex-1 pt-1">
          <ProgressBar value={roomPct} size="md" animate />
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {visible.map(member => (
            <TeamMemberCard
              key={member.userId}
              member={member}
              onClick={() => onMemberClick(member)}
            />
          ))}
        </div>
      ) : null}

      {moreCount > 0 && (
        <p className="mt-3 font-mono text-xs text-ink-muted">
          and {moreCount} more
        </p>
      )}

      {sorted.length === 1 && emptyBody && (
        <p className="mt-3 font-mono text-xs text-ink-muted">{emptyBody}</p>
      )}

      <div className="mt-4">
        <Button
          variant="link"
          size="sm"
          className="px-0"
          trailingIcon={<IconArrowRight size={14} />}
          onClick={onViewAll}
        >
          View all members
        </Button>
      </div>
    </section>
  );
});

function TeamMemberCard({
  member,
  onClick,
}: {
  member: TeamSectionMember;
  onClick: () => void;
}) {
  const pct = memberPct(member);
  const displayName = member.isYou ? `You - ${member.name}` : member.name;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={member.isYou ? 'View your profile' : `View ${member.name}'s details`}
      className={
        'flex min-h-[9.75rem] min-w-0 flex-col items-center rounded-xl bg-well px-2 py-3 text-center transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 '
        + (member.isYou ? 'border-2 border-brand-300 bg-brand-50' : 'border border-white/60')
      }
    >
      <Avatar
        size="md"
        imageUrl={member.imageUrl}
        fallback={member.fallback}
        ring={member.isYou ? 'theme' : 'none'}
        themeColor={member.themeColor}
      />
      <span className="mt-2 block w-full truncate font-mono text-xs font-bold text-ink" title={displayName}>
        {displayName}
      </span>
      <span className="mt-1 font-mono text-sm font-bold text-brand-500">{Math.round(pct)}%</span>
      <span className="sr-only">{formatCurrency(member.saved)} saved</span>
      <div className="mt-2 w-full" aria-hidden>
        <ProgressBar
          value={pct}
          tone={member.themeColor ? 'theme' : 'primary'}
          themeHex={member.themeColor ? themeSwatches[member.themeColor] : undefined}
          size="sm"
          animate
        />
      </div>
      <span className="mt-auto pt-2 text-ink-dim">
        <IconUser size={14} />
      </span>
    </button>
  );
}

function memberPct(member: TeamSectionMember): number {
  return member.target > 0 ? Math.min(100, (member.saved / member.target) * 100) : 0;
}
