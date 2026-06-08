import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Avatar } from '../Avatar/Avatar';
import { IconChevronDown, IconCrown, IconFire, IconUser } from '../Icon/Icon';
import { LeaderProgressRing } from '../LeaderProgressRing/LeaderProgressRing';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { ProgressRing } from '../ProgressRing/ProgressRing';
import { useI18n } from '../../i18n/useI18n';
import { formatCurrency } from '../../lib/format';
import { SPRING } from '../../lib/motion';
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
  streak?: number;
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
}: TeamSectionProps) {
  const { copy } = useI18n();
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [visualActive, setVisualActive] = useState(true);
  const sectionRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => [...members].sort((a, b) => {
    const pctDelta = memberPct(b) - memberPct(a);
    if (pctDelta !== 0) return pctDelta;
    if (b.saved !== a.saved) return b.saved - a.saved;
    return a.name.localeCompare(b.name);
  }), [members]);

  const visible = useMemo(() => sorted.slice(0, 3), [sorted]);
  const roomPct = useMemo(
    () => (roomTarget > 0 ? Math.min(100, (roomSaved / roomTarget) * 100) : 0),
    [roomSaved, roomTarget],
  );
  const isSolo = sorted.length === 1;
  const ranked = useMemo(() => visible.map((member, rank) => ({ member, rank })), [visible]);
  const order = useMemo(
    () => (ranked.length >= 3 ? [ranked[1], ranked[0], ranked[2]]
      : ranked.length === 2 ? [ranked[0], ranked[1]]
        : ranked),
    [ranked],
  );

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisualActive(entry.isIntersecting);
    }, { rootMargin: '120px 0px', threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <section ref={sectionRef} className="overflow-hidden rounded-[2rem] border border-white/45 bg-[linear-gradient(155deg,rgba(255,255,255,0.92)_0%,rgba(255,248,242,0.88)_48%,rgba(249,239,231,0.8)_100%)] px-5 pb-3 pt-4 shadow-[0_22px_50px_rgba(104,71,43,0.12),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-mono text-[1.15rem] font-semibold tracking-[-0.02em] text-ink">
            {copy.nav.team === 'ทีม' ? 'ทุกคนรวมกัน' : 'Everyone Combined'}
          </h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {copy.team.pageSubtitle}
          </p>
        </div>

        <div ref={menuRef} className="relative shrink-0">
          <motion.button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(prev => !prev)}
            className="group flex items-center gap-2 rounded-[1.1rem] border border-white/55 bg-white/35 px-3 py-2 text-ink shadow-[0_12px_24px_rgba(120,89,61,0.12),inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl transition-colors hover:bg-white/55"
            whileTap={reduceMotion ? { opacity: 0.9 } : { scale: 0.98 }}
            transition={SPRING.press}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/55 text-brand-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <IconUser size={16} />
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums">{sorted.length}</span>
            <motion.span
              animate={{ rotate: menuOpen ? 180 : 0 }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }}
              className="text-ink-muted"
            >
              <IconChevronDown size={15} />
            </motion.span>
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -6, scale: 0.98 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-0 top-[calc(100%+0.6rem)] z-30 w-64 origin-top-right rounded-[1.35rem] border border-white/55 bg-white/38 p-2 shadow-[0_20px_40px_rgba(92,64,39,0.18),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl"
              >
                <div role="listbox" aria-label={copy.dashboard.membersInRoom(sorted.length)} className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                  {sorted.map(member => (
                    <motion.button
                      key={member.userId}
                      type="button"
                      role="option"
                      onClick={() => {
                        setMenuOpen(false);
                        onMemberClick?.(member);
                      }}
                      className="flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-left transition-colors hover:bg-white/45"
                      whileTap={reduceMotion ? { opacity: 0.9 } : { scale: 0.985 }}
                    >
                      <Avatar
                        size="sm"
                        imageUrl={member.imageUrl ?? undefined}
                        fallback={member.fallback}
                        themeColor={member.themeColor}
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-ink">
                        {member.name}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {sorted.length > 0 && (
        isSolo ? (
          <div className="mt-7 flex flex-col items-center">
            <Spotlight className="top-8 h-40 w-40" />
            <PodiumCell
              member={visible[0]}
              rank={0}
              isSolo
              onClick={() => onMemberClick?.(visible[0])}
              onDoubleTap={visible[0].isYou ? undefined : () => onMemberNudge?.(visible[0])}
              visualActive={visualActive}
            />
            {emptyBody && (
              <p className="mt-4 max-w-[16rem] text-center font-mono text-xs text-ink-muted">{emptyBody}</p>
            )}
          </div>
        ) : (
          <div className="relative mt-8">
            <Spotlight className="top-6 h-32 w-32" />
            <div className="flex items-end justify-center gap-3 sm:gap-5">
              {order.map(({ member, rank }) => (
                <PodiumCell
                  key={member.userId}
                  member={member}
                  rank={rank}
                  onClick={() => onMemberClick?.(member)}
                  onDoubleTap={member.isYou ? undefined : () => onMemberNudge?.(member)}
                  visualActive={visualActive}
                />
              ))}
            </div>
          </div>
        )
      )}

      <div className="mt-5 px-1 pb-0.5">
        <div className="mb-1.5 flex items-start justify-between gap-3">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {copy.nav.team === 'ทีม' ? 'ทุกคนรวมกัน' : 'Everyone Combined'}
          </span>
          <span className="font-mono text-xs font-semibold tabular-nums leading-none text-brand-800">
            {formatCurrency(roomSaved)} / {formatCurrency(roomTarget)} ({Math.round(roomPct)}%)
          </span>
        </div>
        <ProgressBar value={roomPct} size="lg" animate shimmer={visualActive} />
      </div>
    </section>
  );
});

function formatCompactAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const compact = new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits: abs >= 100000 ? 0 : 1,
    }).format(value);
    return compact.toLowerCase();
  }
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function Spotlight({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(242,107,26,0.18)_0%,rgba(242,107,26,0.08)_42%,rgba(255,255,255,0)_75%)] blur-2xl ${className}`}
    />
  );
}

function PodiumCell({
  member,
  rank,
  isSolo = false,
  onClick,
  onDoubleTap,
  visualActive,
}: {
  member: TeamSectionMember;
  rank: number;
  isSolo?: boolean;
  onClick: () => void;
  onDoubleTap?: () => void;
  visualActive: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const tapTimeoutRef = useRef<number | null>(null);
  const pct = memberPct(member);
  const isLeader = rank === 0;
  const themeHex = member.themeColor ? themeSwatches[member.themeColor] : undefined;
  const ringSize = isSolo ? 'xl' : isLeader ? 'lg' : 'md';
  const showCrown = isLeader && !isSolo;
  const showStreak = (member.streak ?? 0) >= 1;
  const showToday = member.hasLoggedToday === true;
  const displayName = member.name;
  const lineWidth = isSolo ? 'max-w-[13rem]' : isLeader ? 'max-w-[8.75rem]' : 'max-w-[7.25rem]';

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
      className={
        'group relative z-10 flex min-w-0 flex-col items-center rounded-[1.6rem] px-2 py-2 text-center '
        + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface '
        + (showCrown ? '-translate-y-4' : '')
      }
      whileTap={reduceMotion ? { opacity: 0.9 } : { scale: 0.97, y: 2 }}
      transition={SPRING.press}
      layout
    >
      {showCrown && (
        <span
          aria-hidden
          className="absolute -top-[0.5rem] left-1/2 z-20 -translate-x-1/2 text-accent-gold"
        >
          <IconCrown size={21} weight="fill" />
        </span>
      )}

      <div className="relative">
        {isLeader ? (
          <LeaderProgressRing
            value={pct}
            size={ringSize}
            themeHex={themeHex}
            animate
            delayMs={0}
            motionActive={visualActive}
          >
            <RingAvatar
              imageUrl={member.imageUrl}
              fallback={member.fallback}
              diameter={isSolo ? 106 : 82}
            />
          </LeaderProgressRing>
        ) : (
          <ProgressRing
            value={pct}
            size={ringSize}
            themeHex={themeHex}
            animate
            delayMs={70}
            motionActive={visualActive}
          >
            <RingAvatar
              imageUrl={member.imageUrl}
              fallback={member.fallback}
              diameter={58}
            />
          </ProgressRing>
        )}

        {showStreak && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 z-20 inline-flex items-center gap-0.5 rounded-pill bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-800 shadow-soft"
          >
            <IconFire size={11} />
            {member.streak}
          </span>
        )}

        {showToday && (
          <span
            aria-hidden
            className="absolute bottom-1 right-1 z-20 h-3 w-3 rounded-full bg-accent-teal ring-2 ring-white/90"
          />
        )}
      </div>

      <div className="mt-3 flex min-w-0 flex-col items-center gap-1">
        <span className={`block truncate font-mono text-[0.8rem] font-semibold text-ink ${lineWidth}`} title={displayName}>
          {displayName}
        </span>
        <span
          className={`block truncate font-mono text-[11px] font-semibold tabular-nums text-ink-muted ${lineWidth}`}
          style={themeHex ? { color: `${themeHex}CC` } : undefined}
          title={`${formatCurrency(member.saved)} / ${formatCurrency(member.target)} (${Math.round(pct)}%)`}
        >
          {formatCompactAmount(member.saved)} / {formatCompactAmount(member.target)} ({Math.round(pct)}%)
        </span>
      </div>
    </motion.button>
  );
}

function RingAvatar({
  imageUrl,
  fallback,
  diameter,
}: {
  imageUrl?: string | null;
  fallback: string;
  diameter: number;
}) {
  return (
    <div
      className="grid place-items-center overflow-hidden rounded-full bg-brand-100"
      style={{ width: diameter, height: diameter }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-mono text-xl font-bold text-brand-800">{fallback}</span>
      )}
    </div>
  );
}

function memberPct(member: TeamSectionMember): number {
  return member.target > 0 ? Math.min(100, (member.saved / member.target) * 100) : 0;
}
