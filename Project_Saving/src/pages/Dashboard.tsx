import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityFeed } from '../components/ActivityFeed/ActivityFeed';
import { BucketGrid } from '../components/BucketGrid/BucketGrid';
import { Button } from '../components/Button/Button';
import { DashboardHero } from '../components/DashboardHero/DashboardHero';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import {
  IconBed,
  IconBriefcase,
  IconFork,
  IconHome,
  IconPlane,
  IconRocket,
  IconSmartphone,
  IconTicket,
} from '../components/Icon/Icon';
import { useAuth } from '../hooks/useAuth';
import { useBuckets } from '../hooks/useBuckets';
import { useGoal } from '../hooks/useGoal';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useLogs } from '../hooks/useLogs';
import { useRoom } from '../hooks/useRoom';
import { useSavingsTotal } from '../hooks/useSavingsTotal';
import { bucketSaved } from '../lib/buckets';
import { dailyAmountSeries, fallbackInitial, lastSevenDayLabels, weeklyTrendPct } from '../lib/dashboardStats';
import { formatCurrency } from '../lib/format';
import type { Bucket, BucketCategory } from '../types';

export function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { activeRoom, activeRoomId } = useRoom();
  const { goal, loading: goalLoading, error: goalError } = useGoal(activeRoomId);
  const { buckets, loading: bucketsLoading } = useBuckets(activeRoomId);
  const { logs, loading: logsLoading, error: logsError } = useLogs(100, activeRoomId);
  const { total } = useSavingsTotal(user?.id, logs);
  const leaderboard = useLeaderboard(logs, user?.id, activeRoomId);
  const loading = goalLoading || bucketsLoading || logsLoading || leaderboard.loading;
  const error = goalError ?? logsError;

  if (loading) return <StatusCard title="Loading dashboard" body="Syncing the latest deposits and buckets." />;
  if (error) return <StatusCard title="Dashboard needs a refresh" body={error} />;

  const you = leaderboard.entries.find(entry => entry.isYou);
  const partner = leaderboard.entries.find(entry => !entry.isYou);
  const target = goal?.target_amount ?? you?.target ?? 0;
  const totalSaved = leaderboard.entries.reduce((sum, entry) => sum + entry.saved, 0);
  const totalTarget = leaderboard.entries.reduce((sum, entry) => sum + (entry.target ?? 0), 0) || target;
  const selectedBucket = bestMicroGoalBucket(buckets, logs);

  return (
    <div className="flex flex-col gap-8">
      <DashboardHero
        title={activeRoom?.name ?? 'Japan 2027'}
        subtitle={`${profile?.display_name ?? 'You'} saved ${formatCurrency(total)} toward ${formatCurrency(target)}`}
        leftPlayer={{
          name: you?.displayName ?? profile?.display_name ?? 'You',
          fallback: fallbackInitial(you?.displayName ?? profile?.display_name),
          imageUrl: you?.avatarUrl,
          saved: you?.saved ?? total,
          target,
          themeColor: you?.themeColor,
        }}
        rightPlayer={{
          name: partner?.displayName ?? 'Partner',
          fallback: fallbackInitial(partner?.displayName ?? 'Partner'),
          imageUrl: partner?.avatarUrl,
          saved: partner?.saved ?? 0,
          target: partner?.target ?? target,
          themeColor: partner?.themeColor ?? 'teal',
        }}
        saved={totalSaved}
        target={totalTarget}
        trendPct={weeklyTrendPct(logs)}
        momentumSeries={dailyAmountSeries(logs)}
        momentumLabels={lastSevenDayLabels()}
        microGoal={selectedBucket}
      />
      <BucketGrid
        title="Trip Buckets"
        subtitle={buckets.length > 0 ? `${buckets.length} active buckets` : 'Create your first bucket to split the trip.'}
        buckets={buckets.map(bucket => ({
          id: bucket.id,
          icon: bucketIcon(bucket.category),
          name: bucket.name,
          saved: bucketSaved(bucket.id, logs),
          target: bucket.target_amount,
        }))}
        ctaLabel={buckets.length > 0 ? 'Add Bucket' : 'Create Bucket'}
        onAddBucket={() => navigate('/profile?panel=buckets')}
        onBucketClick={() => navigate('/add')}
      />
      {buckets.length === 0 && (
        <Button variant="action" fullWidth onClick={() => navigate('/profile?panel=buckets')}>
          Create First Bucket
        </Button>
      )}
      {logs.length > 0 ? (
        <ActivityFeed items={logs.slice(0, 8).map(log => ({
          id: log.id,
          actorName: log.display_name ?? (log.user_id === user?.id ? profile?.display_name ?? 'You' : 'Partner'),
          actorFallback: fallbackInitial(log.display_name),
          bucketName: log.bucket_name ?? 'Savings',
          amount: log.amount,
          occurredAt: log.created_at,
          hasSlip: Boolean(log.slip_url),
        }))} />
      ) : (
        <StatusCard title="No deposits yet" body={`Start with ${formatCurrency(100)} and let the streak begin.`} />
      )}
    </div>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-soft">
      <SectionLabel tone="brand">Dashboard</SectionLabel>
      <h1 className="mt-2 font-mono text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 font-mono text-xs text-ink-muted">{body}</p>
    </section>
  );
}

function bestMicroGoalBucket(buckets: Bucket[], logs: ReturnType<typeof useLogs>['logs']) {
  const bucket = buckets
    .map(item => ({ bucket: item, saved: bucketSaved(item.id, logs) }))
    .sort((a, b) => (a.bucket.target_amount - a.saved) - (b.bucket.target_amount - b.saved))[0];

  if (!bucket) {
    return {
      icon: <IconRocket size={26} />,
      title: 'First bucket',
      remaining: 0,
      pct: 0,
      subtitle: 'Create a bucket from Profile',
    };
  }

  return {
    icon: bucketIcon(bucket.bucket.category),
    title: bucket.bucket.name,
    remaining: Math.max(0, bucket.bucket.target_amount - bucket.saved),
    pct: bucket.bucket.target_amount > 0 ? Math.min(100, Math.round((bucket.saved / bucket.bucket.target_amount) * 100)) : 0,
    subtitle: `${formatCurrency(bucket.saved)} saved`,
  };
}

function bucketIcon(category: BucketCategory | undefined): ReactNode {
  if (category === 'flight' || category === 'travel') return <IconPlane size={22} />;
  if (category === 'accom') return <IconBed size={22} />;
  if (category === 'dining') return <IconFork size={22} />;
  if (category === 'activities' || category === 'transport') return <IconTicket size={22} />;
  if (category === 'gear') return <IconSmartphone size={22} />;
  if (category === 'home') return <IconHome size={22} />;
  return <IconBriefcase size={22} />;
}
