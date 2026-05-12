import { useState, type ReactNode } from 'react';
import { ActivityFeed } from '../components/ActivityFeed/ActivityFeed';
import { ActivityHistoryModal } from '../components/ActivityHistoryModal/ActivityHistoryModal';
import { BucketRow } from '../components/BucketRow/BucketRow';
import { BucketRowExpandable } from '../components/BucketRowExpandable/BucketRowExpandable';
import { BucketGrid } from '../components/BucketGrid/BucketGrid';
import { Button } from '../components/Button/Button';
import { CreateBucketForm } from '../components/CreateBucketForm/CreateBucketForm';
import { DashboardHero } from '../components/DashboardHero/DashboardHero';
import { NudgeButton } from '../components/NudgeButton/NudgeButton';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { Segmented } from '../components/Segmented/Segmented';
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
import { SavingRaceChart } from '../components/SavingRaceChart/SavingRaceChart';
import { SavingRaceFilter } from '../components/SavingRaceFilter/SavingRaceFilter';
import { useAuth } from '../hooks/useAuth';
import { useBuckets } from '../hooks/useBuckets';
import { useGoal } from '../hooks/useGoal';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { useLogs } from '../hooks/useLogs';
import { usePartnerBuckets } from '../hooks/usePartnerBuckets';
import { useProfile } from '../hooks/useProfile';
import { useRoom } from '../hooks/useRoom';
import { useSavingsTotal } from '../hooks/useSavingsTotal';
import { bucketSaved } from '../lib/buckets';
import { cumulativeRaceSeries } from '../lib/comparisonStats';
import { dailyAmountSeries, fallbackInitial, lastSevenDayLabels, weeklyTrendPct } from '../lib/dashboardStats';
import { formatCurrency } from '../lib/format';
import { haptic } from '../lib/haptics';
import type { Bucket, BucketCategory } from '../types';

export function Dashboard() {
  const { user, profile } = useAuth();
  const { quickAmounts } = useProfile();
  const { activeRoom, activeRoomId } = useRoom();
  const { goal, loading: goalLoading, error: goalError } = useGoal(activeRoomId);
  const { buckets, loading: bucketsLoading, saveBuckets } = useBuckets(activeRoomId);
  const { logs, loading: logsLoading, error: logsError, insert } = useLogs(100, activeRoomId);
  const { total } = useSavingsTotal(user?.id, logs);
  const leaderboard = useLeaderboard(logs, user?.id, activeRoomId);
  const partnerEntry = leaderboard.entries.find(entry => !entry.isYou);
  const { buckets: partnerBuckets } = usePartnerBuckets(activeRoomId, partnerEntry?.userId);
  const [bucketView, setBucketView] = useState<'mine' | 'partner'>('mine');
  const [expandedBucketId, setExpandedBucketId] = useState<string | null>(null);
  const [bucketModalOpen, setBucketModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const partnerBucketItems = partnerBuckets.map(bucket => ({
    id: bucket.id,
    icon: bucketIcon(bucket.category),
    name: bucket.name,
    saved: bucketSaved(bucket.id, logs),
    target: bucket.target_amount,
  }));
  const partnerName = partnerEntry?.displayName ?? 'Partner';
  const activityItems = logs.map(log => ({
    id: log.id,
    actorName: log.display_name ?? (log.user_id === user?.id ? profile?.display_name ?? 'You' : 'Partner'),
    actorFallback: fallbackInitial(log.display_name),
    bucketName: log.bucket_name ?? 'Savings',
    amount: log.amount,
    occurredAt: log.created_at,
    hasSlip: Boolean(log.slip_url),
    slipUrl: log.slip_url,
  }));
  const hasPartnerBuckets = Boolean(partnerEntry) && partnerBucketItems.length > 0;
  const showingPartner = bucketView === 'partner' && hasPartnerBuckets;

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
      {partnerEntry && (
        <div className="flex justify-end">
          <NudgeButton
            partnerUserId={partnerEntry.userId}
            roomId={activeRoomId}
            partnerName={partnerEntry.displayName ?? 'Partner'}
          />
        </div>
      )}
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
        momentumSeries={dailyAmountSeries(logs, user?.id)}
        partnerMomentumSeries={partnerEntry ? dailyAmountSeries(logs, partnerEntry.userId) : undefined}
        yourName={profile?.display_name ?? 'You'}
        partnerName={partnerEntry?.displayName ?? 'Partner'}
        momentumLabels={lastSevenDayLabels()}
        microGoal={selectedBucket}
      />
      {partnerEntry && (
        <SavingRaceSection
          logs={logs}
          buckets={[...buckets, ...partnerBuckets]}
          yourUserId={user?.id}
          partnerUserId={partnerEntry.userId}
          yourName={profile?.display_name ?? 'You'}
          partnerName={partnerEntry.displayName}
          activeRoomId={activeRoomId}
        />
      )}
      {hasPartnerBuckets && (
        <div className="-mb-2 flex items-center justify-end gap-2">
          <Segmented
            ariaLabel="Switch bucket owner"
            options={[
              { value: 'mine', label: 'You' },
              { value: 'partner', label: partnerName },
            ]}
            value={bucketView}
            onChange={next => {
              setBucketView(next);
              setExpandedBucketId(null);
            }}
          />
        </div>
      )}
      {showingPartner ? (
        <section className="flex flex-col gap-3">
          <div className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 py-3 backdrop-blur">
            <SectionLabel tone="brand">Smart Buckets</SectionLabel>
            <h2 className="mt-1 font-mono text-2xl font-bold text-ink truncate">{partnerName}'s Buckets</h2>
            <p className="mt-1 font-mono text-xs text-ink-muted">
              {partnerBucketItems.length} bucket{partnerBucketItems.length === 1 ? '' : 's'} — read-only
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {partnerBucketItems.map(bucket => (
              <BucketRow
                key={bucket.id}
                icon={bucket.icon}
                name={bucket.name}
                saved={bucket.saved}
                target={bucket.target}
              />
            ))}
          </div>
        </section>
      ) : (
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
              quickAmounts={quickAmounts}
              expanded={expandedBucketId === bucket.id}
              onToggle={() => setExpandedBucketId(expandedBucketId === bucket.id ? null : bucket.id)}
              onCancel={() => setExpandedBucketId(null)}
              onConfirm={async amount => {
                const prev = bucket.saved;
                const result = await insert(amount, bucket.id);
                if (!result.error) {
                  const reached = prev < bucket.target && prev + amount >= bucket.target;
                  haptic(reached ? 'milestone' : 'success');
                }
                return result;
              }}
            />
          )}
        />
      )}
      {buckets.length === 0 && (
        <Button variant="action" fullWidth onClick={() => setBucketModalOpen(true)}>
          Create First Bucket
        </Button>
      )}
      {message && <p className="rounded-2xl bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>}
      {logs.length > 0 ? (
        <>
          <ActivityFeed
            items={activityItems}
            onViewMore={() => setHistoryOpen(true)}
            previewLimit={5}
          />
          <ActivityHistoryModal
            open={historyOpen}
            onClose={() => setHistoryOpen(false)}
            items={activityItems}
          />
        </>
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

interface SavingRaceSectionProps {
  logs: ReturnType<typeof useLogs>['logs'];
  buckets: Bucket[];
  yourUserId: string | undefined;
  partnerUserId: string;
  yourName: string;
  partnerName: string;
  activeRoomId: string | null;
}

/**
 * Renders the Saving Race line chart with a bucket-scope filter. The
 * filter selection persists per room in localStorage so opening the
 * Dashboard later restores the previously-viewed scope.
 *
 * Defined here (in the same file as `Dashboard`) because the
 * filter-to-series wiring is single-use Dashboard concern; promoting
 * to a shared component would force the parent to plumb props that
 * only this view needs.
 */
function SavingRaceSection({ logs, buckets, yourUserId, partnerUserId, yourName, partnerName, activeRoomId }: SavingRaceSectionProps) {
  const storageKey = `saving-race-filter:${activeRoomId ?? 'no-room'}`;
  const [bucketFilter, setBucketFilter] = useLocalStorageState<string | null>(storageKey, null);
  const dedupedOptions = Array.from(new Map(buckets.map(b => [b.id, { id: b.id, name: b.name }])).values());
  const scopeBucket = buckets.find(b => b.id === bucketFilter) ?? null;
  const scopeLabel = scopeBucket ? `Scope: ${scopeBucket.name}` : 'Scope: all buckets / main goal';
  const yourSeries = cumulativeRaceSeries(logs, yourUserId, bucketFilter);
  const partnerSeries = cumulativeRaceSeries(logs, partnerUserId, bucketFilter);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <SectionLabel tone="brand">Competition</SectionLabel>
        <SavingRaceFilter buckets={dedupedOptions} value={bucketFilter} onChange={setBucketFilter} />
      </div>
      <SavingRaceChart
        yourSeries={yourSeries}
        partnerSeries={partnerSeries}
        labels={lastSevenDayLabels()}
        yourName={yourName}
        partnerName={partnerName}
        scopeLabel={scopeLabel}
      />
    </section>
  );
}
