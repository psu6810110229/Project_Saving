import { memo, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Avatar } from '../Avatar/Avatar';
import { Button } from '../Button/Button';
import { IconArrowRight, IconCrown, IconFire } from '../Icon/Icon';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { ProgressRing } from '../ProgressRing/ProgressRing';
import { formatCurrency } from '../../lib/format';
import { themeSwatches, type ThemeSwatch } from '../../lib/theme';
import { SPRING } from '../../lib/motion';

export interface TeamSectionMember {
  userId: string;
  name: string;
  fallback: string;
  imageUrl?: string | null;
  saved: number;
  target: number;
  themeColor?: ThemeSwatch;
  isYou: boolean;
  /** Save streak; the flame chip renders only when >= 1 (positive-only). */
  streak?: number;
  /** Whether the member logged today; the today-dot renders only when true. */
  hasLoggedToday?: boolean;
}

interface TeamSectionProps {
  members: TeamSectionMember[];
  roomSaved: number;
  roomTarget: number;
  emptyBody?: string;
  onMemberClick?: (member: TeamSectionMember) => void;
  onMemberNudge?: (member: TeamSectionMember) => void;
  onViewAll?: () => void;
}

export const TeamSection = memo(function TeamSection({
  members,
  roomSaved,
  roomTarget,
  emptyBody,
  onMemberClick,
  onMemberNudge,
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
  const isSolo = sorted.length === 1;

  // Rank by sort order (0 = gold, 1 = silver, 2 = bronze), then arrange so the
  // leader sits raised in the centre: silver · gold · bronze.
  const ranked = visible.map((member, rank) => ({ member, rank }));
  const order =
    ranked.length >= 3 ? [ranked[1], ranked[0], ranked[2]]
    : ranked.length === 2 ? [ranked[0], ranked[1]]
    : ranked;

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

      {sorted.length > 0 && (
        isSolo ? (
          <div className="mt-5 flex flex-col items-center gap-3">
            <div className="relative">
              <Spotlight className="top-1/2 h-36 w-36 -translate-y-1/2" />
              <PodiumCell
                member={visible[0]}
                rank={0}
                isSolo
                onClick={() => onMemberClick?.(visible[0])}
                onDoubleTap={visible[0].isYou ? undefined : () => onMemberNudge?.(visible[0])}
              />
            </div>
            {emptyBody && (
              <p className="max-w-[16rem] text-center font-mono text-xs text-ink-muted">{emptyBody}</p>
            )}
          </div>
        ) : (
          <div className="relative mt-5 flex items-end justify-center gap-3 sm:gap-4">
            <Spotlight className="top-2 h-28 w-28" />
            {order.map(({ member, rank }) => (
              <PodiumCell
                key={member.userId}
                member={member}
                rank={rank}
                onClick={() => onMemberClick?.(member)}
                onDoubleTap={member.isYou ? undefined : () => onMemberNudge?.(member)}
              />
            ))}
          </div>
        )
      )}

      {moreCount > 0 && (
        <p className="mt-4 text-center font-mono text-xs text-ink-muted">
          and {moreCount} more
        </p>
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

/** Soft static brand glow behind the champion — the "spotlight". */
function Spotlight({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-brand-200/35 blur-2xl ${className}`}
    />
  );
}

function PodiumCell({
  member,
  rank,
  isSolo = false,
  onClick,
  onDoubleTap,
}: {
  member: TeamSectionMember;
  rank: number;
  isSolo?: boolean;
  onClick: () => void;
  onDoubleTap?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const tapTimeoutRef = useRef<number | null>(null);
  const pct = memberPct(member);
  const isGold = rank === 0;
  const themeHex = member.themeColor ? themeSwatches[member.themeColor] : undefined;
  const ringSize = isSolo ? 'xl' : isGold ? 'lg' : 'md';
  const avatarSize = isSolo ? 'xl' : isGold ? 'lg' : 'md';
  const displayName = member.isYou ? `You - ${member.name}` : member.name;
  const showCrown = isGold && !isSolo;
  const showStreak = (member.streak ?? 0) >= 1;
  const showToday = member.hasLoggedToday === true;

  const pctText = isSolo ? 'text-2xl' : isGold ? 'text-base' : 'text-sm';
  const nameMax = isSolo ? 'max-w-[12rem]' : 'max-w-[5.5rem]';
  const ariaLabel = `${showCrown ? 'Leader, ' : ''}${displayName}, ${Math.round(pct)}% of goal saved`;

  useEffect(() => () => {
    if (tapTimeoutRef.current !== null) {
      window.clearTimeout(tapTimeoutRef.current);
    }
  }, []);

  function handleClick(detail: number) {
    if (!onDoubleTap) {
      onClick();
      return;
    }

    if (detail >= 2) {
      if (tapTimeoutRef.current !== null) {
        window.clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      onDoubleTap();
      return;
    }

    tapTimeoutRef.current = window.setTimeout(() => {
      tapTimeoutRef.current = null;
      onClick();
    }, 220);
  }

  return (
    <motion.button
      type="button"
      onClick={event => handleClick(event.detail)}
      aria-label={ariaLabel}
      className={
        'group relative z-10 flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1.5 py-2 '
        + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface '
        + '[touch-action:manipulation] '
        + (showCrown ? '-translate-y-3 ' : '')
        + (member.isYou ? 'bg-brand-50/70 ' : '')
      }
      whileTap={reduceMotion ? { opacity: 0.85 } : { scale: 0.97, y: 2 }}
      transition={SPRING.press}
    >
      {showCrown && (
        <span
          aria-hidden
          className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 animate-corner-pop text-accent-gold"
        >
          <IconCrown size={18} weight="fill" />
        </span>
      )}

      <div className="relative">
        <ProgressRing
          value={pct}
          size={ringSize}
          themeHex={themeHex}
          animate
          delayMs={isGold ? 0 : 80}
        >
          <Avatar size={avatarSize} imageUrl={member.imageUrl} fallback={member.fallback} />
        </ProgressRing>

        {showStreak && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 z-20 inline-flex items-center gap-0.5 rounded-pill bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-800 shadow-soft"
          >
            <IconFire size={11} />
            {member.streak}
          </span>
        )}

        {showToday && (
          <span
            aria-hidden
            className="absolute bottom-0.5 right-1 z-20 h-3 w-3 rounded-full bg-accent-teal ring-2 ring-surface"
          />
        )}
      </div>

      <span className={`mt-1 block truncate font-mono text-xs font-bold text-ink ${nameMax}`} title={displayName}>
        {displayName}
      </span>
      <span
        className={`font-mono font-bold tabular-nums text-brand-800 ${pctText}`}
        style={themeHex ? { color: themeHex } : undefined}
      >
        {Math.round(pct)}%
      </span>
      <span className="sr-only">{formatCurrency(member.saved)} saved</span>
    </motion.button>
  );
}

function memberPct(member: TeamSectionMember): number {
  return member.target > 0 ? Math.min(100, (member.saved / member.target) * 100) : 0;
}
