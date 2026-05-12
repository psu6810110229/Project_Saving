import { useState, type ReactNode } from 'react';
import { ActivityFeed } from '../components/ActivityFeed/ActivityFeed';
import { BucketRowExpandable } from '../components/BucketRowExpandable/BucketRowExpandable';
import { BucketGrid } from '../components/BucketGrid/BucketGrid';
import { Button } from '../components/Button/Button';
import { CreateBucketForm } from '../components/CreateBucketForm/CreateBucketForm';
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
import { Modal } from '../components/Modal/Modal';
import { PageHeader } from '../components/PageHeader/PageHeader';
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

const QUICK_AMOUNTS = [100, 500, 1000, 2000];

export function Dashboard() {
  const { user, profile } = useAuth();
  const { activeRoom, activeRoomId } = useRoom();
  const { goal, loading: goalLoading, error: goalError } = useGoal(activeRoomId);
  const { buckets, loading: bucketsLoading, saveBuckets } = useBuckets(activeRoomId);
  const { logs, loading: logsLoading, error: logsError, insert } = useLogs(100, activeRoomId);
  const { total } = useSavingsTotal(user?.id, logs);
  const leaderboard = useLeaderboard(logs, user?.id, activeRoomId);
  const [expandedBucketId, setExpandedBucketId] = useState<string | null>(null);
  const [bucketModalOpen, setBucketModalOpen] = useState(false);
  const [bucketCategory, setBucketCategory] = useState<BucketCategory | null>('flight');
  const [bucketName, setBucketName] = useState('Flights');
  const [bucketTarget, setBucketTarget] = useState('30000');
  const [message, setMessage] = useState<string | null>(null);
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
  const bucketItems = buckets.map(bucket => ({
    id: bucket.id,
    icon: bucketIcon(bucket.category),
    name: bucket.name,
    saved: bucketSaved(bucket.id, logs),
    target: bucket.target_amount,
  }));

  async function handleCreateBucket() {
    const nextTarget = Number(bucketTarget);
    if (!bucketCategory || !bucketName.trim() || nextTarget <= 0) {
      setMessage('Add a bucket name, target, and category.');
      return;
    }
    const result = await saveBuckets([
      ...buckets,
      { id: undefined, name: bucketName.trim(), target_amount: nextTarget, category: bucketCategory },
    ]);
    if (result.error) setMessage(result.error);
    else {
      setMessage(null);
      setBucketName('');
      setBucketTarget('');
      setBucketModalOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Dashboard" title={activeRoom?.name ?? 'Japan 2027'} subtitle="Shared vault overview" />
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
        buckets={bucketItems}
        ctaLabel={buckets.length > 0 ? 'Add Bucket' : 'Create Bucket'}
        onAddBucket={() => setBucketModalOpen(true)}
        renderBucket={bucket => (
          <BucketRowExpandable
            icon={bucket.icon}
            name={bucket.name}
            saved={bucket.saved}
            target={bucket.target}
            quickAmounts={QUICK_AMOUNTS}
            expanded={expandedBucketId === bucket.id}
            onToggle={() => setExpandedBucketId(expandedBucketId === bucket.id ? null : bucket.id)}
            onCancel={() => setExpandedBucketId(null)}
            onConfirm={amount => insert(amount, bucket.id)}
          />
        )}
      />
      {buckets.length === 0 && (
        <Button variant="action" fullWidth onClick={() => setBucketModalOpen(true)}>
          Create First Bucket
        </Button>
      )}
      {message && <p className="rounded-2xl bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>}
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
      <Modal open={bucketModalOpen} title="Add Bucket" onClose={() => setBucketModalOpen(false)}>
        <div className="flex flex-col gap-4">
          {message && <p className="rounded-2xl bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>}
          <CreateBucketForm
            category={bucketCategory}
            options={bucketOptions}
            name={bucketName}
            target={bucketTarget}
            onCategoryChange={setBucketCategory}
            onNameChange={setBucketName}
            onTargetChange={value => setBucketTarget(value.replace(/[^0-9]/g, ''))}
            onSubmit={handleCreateBucket}
          />
        </div>
      </Modal>
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

const bucketOptions = [
  { id: 'flight' as const, label: 'Flight', icon: <IconPlane size={22} /> },
  { id: 'accom' as const, label: 'Stay', icon: <IconBed size={22} /> },
  { id: 'dining' as const, label: 'Dining', icon: <IconFork size={22} /> },
  { id: 'activities' as const, label: 'Activity', icon: <IconTicket size={22} /> },
  { id: 'gear' as const, label: 'Gear', icon: <IconSmartphone size={22} /> },
  { id: 'home' as const, label: 'Home', icon: <IconHome size={22} /> },
];
