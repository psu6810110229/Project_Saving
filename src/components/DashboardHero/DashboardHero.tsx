import type { ReactNode } from 'react';
import type { ThemeSwatch } from '../../lib/theme';
import { HeadToHeadCard } from '../HeadToHeadCard/HeadToHeadCard';
import { MicroGoalCard } from '../MicroGoalCard/MicroGoalCard';
import { MomentumChart } from '../MomentumChart/MomentumChart';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { TotalVaultCard } from '../TotalVaultCard/TotalVaultCard';

interface DashboardPlayer {
  name: string;
  fallback: string;
  imageUrl?: string | null;
  saved: number;
  target: number;
  themeColor?: ThemeSwatch;
  isYou?: boolean;
}

interface DashboardMicroGoal {
  icon: ReactNode;
  title: string;
  remaining: number;
  pct: number;
  subtitle?: string;
}

interface DashboardHeroProps {
  title: string;
  subtitle?: string;
  leftPlayer: DashboardPlayer;
  rightPlayer: DashboardPlayer;
  saved: number;
  target: number;
  momentumSeries: number[];
  /** Optional partner daily totals for the side-by-side bar chart. */
  partnerMomentumSeries?: number[];
  /** Display name used in the chart legend for the primary series. */
  yourName?: string;
  /** Display name used in the chart legend for the partner series. */
  partnerName?: string;
  momentumLabels?: string[];
  microGoal: DashboardMicroGoal;
}

export function DashboardHero({
  title,
  subtitle,
  leftPlayer,
  rightPlayer,
  saved,
  target,
  momentumSeries,
  partnerMomentumSeries,
  yourName,
  partnerName,
  momentumLabels,
  microGoal,
}: DashboardHeroProps) {
  return (
    <section className="flex flex-col gap-3">
      <header>
        <SectionLabel tone="brand">Dashboard</SectionLabel>
        <h2 className="mt-2 font-mono text-3xl font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-1 font-mono text-xs text-ink-muted">{subtitle}</p>}
      </header>
      <HeadToHeadCard left={leftPlayer} right={rightPlayer} />
      <TotalVaultCard saved={saved} target={target} />
      <MomentumChart
        series={momentumSeries}
        partnerSeries={partnerMomentumSeries}
        labels={momentumLabels}
        yourName={yourName}
        partnerName={partnerName}
        todayIndex={6}
      />
      <MicroGoalCard {...microGoal} />
    </section>
  );
}
