import { motion, useReducedMotion } from 'framer-motion';
import { Avatar } from '../Avatar/Avatar';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';
import type { ThemeSwatch } from '../../lib/theme';
import { MOTION_DURATION, MOTION_EASE, REDUCED_MOTION_TRANSITION } from '../../lib/motion';

/**
 * Static, non-interactive "what you'll get" preview shown on the
 * no-project landing screen. Reuses the real vault + member-row visual
 * language with hardcoded sample numbers so a brand-new user can picture
 * the product before committing. It is NOT a live demo room — purely
 * illustrative, hence `role="img"` and a single aria-label.
 */

const EXAMPLE = {
  saved: 42_000,
  target: 60_000,
  members: [
    { saved: 24_000, target: 30_000, theme: 'teal' as ThemeSwatch, fallback: 'M', leader: true },
    { saved: 18_000, target: 30_000, theme: 'terracotta' as ThemeSwatch, fallback: 'P', leader: false },
  ],
};

function pct(saved: number, target: number): number {
  return target > 0 ? (saved / target) * 100 : 0;
}

export function ProjectSetupShowcase() {
  const { copy } = useI18n();
  const ps = copy.projectSetup;
  const reduceMotion = useReducedMotion();
  const vaultPct = Math.round(pct(EXAMPLE.saved, EXAMPLE.target));

  return (
    <motion.section
      role="img"
      aria-label={ps.exampleAria}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={
        reduceMotion
          ? REDUCED_MOTION_TRANSITION
          : { duration: MOTION_DURATION.page, ease: MOTION_EASE.emphasized }
      }
      className="relative rounded-2xl bg-well p-4"
    >
      <span className="absolute right-3 top-3 z-10 rounded-pill bg-surface px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted shadow-soft">
        {ps.exampleBadge}
      </span>

      {/* Mock vault card — mirrors TotalVaultCard's styling with a deeper tone
          so it reads as a quiet preview rather than competing with the bright
          Join call-to-action above it. */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 px-4 py-3 text-white shadow-soft">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-bold text-white">{ps.exampleVaultTitle}</span>
          <span className="font-mono text-sm font-bold tabular-nums text-white/90">{vaultPct}%</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold tabular-nums">{formatCurrency(EXAMPLE.saved)}</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-white/80">
            / {formatCurrency(EXAMPLE.target)}
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-pill bg-white/[0.35]">
          <div
            className="h-full rounded-pill bg-white"
            style={{ width: `${Math.max(0, Math.min(100, vaultPct))}%` }}
          />
        </div>
      </div>

      {/* Two sample member rows. */}
      <div className="mt-3 flex flex-col gap-2">
        {EXAMPLE.members.map((m, i) => {
          const memberPct = pct(m.saved, m.target);
          return (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-soft">
              <Avatar
                size="md"
                fallback={m.fallback}
                ring={m.leader ? 'leader' : 'theme'}
                themeColor={m.theme}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 font-mono">
                  <span className="text-lg font-bold text-brand-500 tabular-nums">
                    {formatCurrency(m.saved)}
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                    / {formatCurrency(m.target)}
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={memberPct} tone={i === 0 ? 'primary' : 'muted'} size="sm" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
