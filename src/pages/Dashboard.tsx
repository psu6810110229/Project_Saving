import { useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityHistoryModal } from '../components/ActivityHistoryModal/ActivityHistoryModal';
import { ActivityTimelineRow } from '../components/ActivityTimelineRow/ActivityTimelineRow';
import { BalanceCheckStatus } from '../components/BalanceCheckStatus/BalanceCheckStatus';
import { SavingPlanCard } from '../components/SavingPlanCard/SavingPlanCard';
import { BucketRow } from '../components/BucketRow/BucketRow';
import { BucketRowExpandable } from '../components/BucketRowExpandable/BucketRowExpandable';
import { BucketGrid } from '../components/BucketGrid/BucketGrid';
import { Button } from '../components/Button/Button';
import { CreateBucketForm } from '../components/CreateBucketForm/CreateBucketForm';
import { HeadToHeadCard } from '../components/HeadToHeadCard/HeadToHeadCard';
import { IconBubble } from '../components/IconBubble/IconBubble';
import { MicroGoalCard } from '../components/MicroGoalCard/MicroGoalCard';
import { MomentumChart } from '../components/MomentumChart/MomentumChart';
import { TotalVaultCard } from '../components/TotalVaultCard/TotalVaultCard';
import { NudgeButton } from '../components/NudgeButton/NudgeButton';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { Segmented } from '../components/Segmented/Segmented';
import {
  IconBed,
  IconBriefcase,
  IconCheck,
  IconFork,
  IconHome,
  IconPlane,
  IconRocket,
  IconSmartphone,
  IconTicket,
  IconVault,
} from '../components/Icon/Icon';
import { Modal } from '../components/Modal/Modal';
import { SavingRaceChart } from '../components/SavingRaceChart/SavingRaceChart';
import { SavingRaceFilter } from '../components/SavingRaceFilter/SavingRaceFilter';
import { useAuth } from '../hooks/useAuth';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { useBuckets } from '../hooks/useBuckets';
import { useGoal } from '../hooks/useGoal';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { useLogs } from '../hooks/useLogs';
import { usePartnerBuckets } from '../hooks/usePartnerBuckets';
import { useProfile } from '../hooks/useProfile';
import { useReconcile } from '../hooks/useReconcile';
import { useRoom } from '../hooks/useRoom';
import { useSavingPlan } from '../hooks/useSavingPlan';
import { useSavingsTotal } from '../hooks/useSavingsTotal';
import { bucketSaved, sumTargets } from '../lib/buckets';
import { cumulativeRaceSeries } from '../lib/comparisonStats';
import { dailyAmountSeries, fallbackInitial, lastSevenDateKeys, lastSevenDayLabels, weeklyTrendPct } from '../lib/dashboardStats';
import { formatCurrency, formatRelativeTime } from '../lib/format';
import { haptic } from '../lib/haptics';
import { daysSince, formatSignedCurrency, reasonLabel } from '../lib/reconcile';
import {
  activeRevisionAt,
  addDays,
  habitStatusFromDeposits,
  isPausedOnDate,
  moneyStatusFor,
  plannedAmountForDate,
  todayBangkokKey,
} from '../lib/savingPlan';
import { PlanInsightStrip } from '../components/PlanInsightStrip/PlanInsightStrip';
import type { SavingPlanPause, SavingPlanRevision } from '../types';
import type { BalanceActivityEntry, Bucket, BucketCategory } from '../types';

/**
 * Subtle staggered reveal so the Dashboard reads as one composed page
 * instead of independently-popping cards. Pair `.reveal-section` with
 * a CSS animation-delay; the global `prefers-reduced-motion` block in
 * `styles/global.css` collapses every duration to ~0ms automatically.
 */
function revealStyle(delayMs: number): CSSProperties {
  return { animationDelay: `${delayMs}ms` };
}

// Toggle to re-enable the "Next Win" micro-goal block without
// untangling its data preparation. Kept off-canvas while the
// Dashboard hierarchy focuses on Vault / Race / Plan.
const SHOW_NEXT_WIN = false;

// Old Deposit Race chart is hidden from the primary Dashboard while
// Daily Trend (MomentumChart) covers expected-vs-recorded. Component
// preserved for re-enablement.
const SHOW_DEPOSIT_RACE = false;

export function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { quickAmounts } = useProfile();
  const { activeRoom, activeRoomId } = useRoom();
  const { goal, loading: goalLoading, error: goalError } = useGoal(activeRoomId);
  const { buckets, loading: bucketsLoading, saveBuckets } = useBuckets(activeRoomId);
  const { logs, loading: logsLoading, error: logsError, insert } = useLogs(100, activeRoomId);
  const { total } = useSavingsTotal(user?.id, logs);
  const leaderboard = useLeaderboard(logs, user?.id, activeRoomId);
  const {
    latest: latestCheckpoint,
    activity: balanceActivity,
    appBalance: reconciledAppBalance,
  } = useReconcile(activeRoomId);
  const { plan: savingPlan, deposits: planDeposits } = useSavingPlan(activeRoomId);
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

  if (loading) return <DashboardSkeleton />;
  if (error) return <StatusCard title="Dashboard needs a refresh" body={error} />;

  const you = leaderboard.entries.find(entry => entry.isYou);
  const partner = leaderboard.entries.find(entry => !entry.isYou);
  const target = goal?.target_amount ?? you?.target ?? 0;
  const totalSaved = leaderboard.entries.reduce((sum, entry) => sum + entry.saved, 0);
  const totalTarget = leaderboard.entries.reduce((sum, entry) => sum + (entry.target ?? 0), 0) || target;
  const bucketTargetTotal = sumTargets(buckets);
  const bucketTargetRemaining = target > 0 ? Math.max(0, target - bucketTargetTotal) : null;
  const newBucketTargetAmount = Number(bucketTarget);
  const newBucketExceedsCapacity = bucketTargetRemaining !== null
    && Number.isFinite(newBucketTargetAmount)
    && newBucketTargetAmount > bucketTargetRemaining;
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

  // Saving Plan status — computed once for the primary insight card.
  const todayKey = todayBangkokKey();
  const activeRule = savingPlan
    ? activeRevisionAt(savingPlan.revisions, todayKey)?.rule_type ?? null
    : null;
  const planPauses = savingPlan?.pauses ?? [];
  const isPausedToday = savingPlan ? isPausedOnDate(planPauses, todayKey) : false;
  const openPause = planPauses.find(p => p.resumed_from === null) ?? null;
  const pausedSince = openPause?.paused_from ?? null;
  const activePlanRevision = savingPlan
    ? activeRevisionAt(savingPlan.revisions, todayKey)
    : null;
  const planSummary = activePlanRevision ? buildPlanSummary(activePlanRevision) : null;
  const moneyStatus = savingPlan
    ? moneyStatusFor(savingPlan.revisions, planDeposits.total, todayKey, planPauses)
    : null;
  const habitStatus = habitStatusFromDeposits(
    activeRule,
    planDeposits.deposit_day_keys,
    todayKey,
    isPausedToday,
  );
  const savedToday = logs.reduce((sum, log) => {
    if (log.user_id !== user?.id) return sum;
    const key = todayBangkokKey(new Date(log.created_at));
    return key === todayKey ? sum + log.amount : sum;
  }, 0);

  // Pack the Verified Balance slot for the Saving Plan island so
  // both ideas read as one financial picture; the underlying
  // BalanceCheckStatus card is only used as a fallback empty state.
  const checkpointDays = latestCheckpoint ? daysSince(latestCheckpoint.checked_at) : null;
  const verifiedSinceLabel = checkpointDays === null
    ? 'never'
    : checkpointDays === 0
      ? 'today'
      : checkpointDays === 1
        ? '1d ago'
        : `${checkpointDays}d ago`;
  const verifiedBalanceSlot = reconciledAppBalance !== null
    ? {
        amount: reconciledAppBalance,
        sinceLabel: verifiedSinceLabel,
        matched: latestCheckpoint ? latestCheckpoint.difference_amount === 0 : false,
        diff: latestCheckpoint?.difference_amount ?? 0,
        onCheck: () => navigate('/check-balance'),
      }
    : null;

  // Merged activity feed: top 3 most-recent items across deposits and
  // balance checks. Each item keeps its native kind so the row UI
  // can match (deposit timeline row vs sanitized balance-check row).
  const mergedActivity = buildMergedActivity(activityItems, balanceActivity, 3, user?.id);

  // Saving Plan chart overlays: per-day Expected Progress aligned to
  // the same 7-day window the deposit charts use. We deliberately do
  // not include Verified Balance here — these series are Recorded vs
  // Expected only.
  const revisions = savingPlan?.revisions ?? null;
  const chartDayKeys = lastSevenDateKeys();
  const expectedDailySeries = revisions
    ? chartDayKeys.map(key => plannedAmountForDate(revisions, key, planPauses))
    : undefined;
  const expectedCumulativeSeries = revisions
    ? (() => {
        let running = 0;
        return chartDayKeys.map(key => {
          running += plannedAmountForDate(revisions, key, planPauses);
          return running;
        });
      })()
    : undefined;

  // Compact this-week / this-month summary tile. Bangkok-aware.
  const weekStartKey = (() => {
    const [y, m, d] = todayKey.split('-').map(Number);
    // Monday-anchored ISO week: dayOfWeek - 1 days back (Sun -> 6).
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const daysSinceMonday = (dow + 6) % 7;
    return addDays(todayKey, -daysSinceMonday);
  })();
  const monthStartKey = `${todayKey.slice(0, 7)}-01`;
  const planInsight = revisions
    ? {
        week: {
          recorded: recordedBetween(logs, user?.id, weekStartKey, todayKey),
          expected: expectedBetween(revisions, weekStartKey, todayKey, planPauses),
        },
        month: {
          recorded: recordedBetween(logs, user?.id, monthStartKey, todayKey),
          expected: expectedBetween(revisions, monthStartKey, todayKey, planPauses),
        },
      }
    : null;

  const youName = you?.displayName ?? profile?.display_name ?? 'You';
  const leftPlayer = {
    name: youName,
    fallback: fallbackInitial(you?.displayName ?? profile?.display_name),
    imageUrl: you?.avatarUrl,
    saved: you?.saved ?? total,
    target,
    themeColor: you?.themeColor,
    isYou: true,
  };
  const rightPlayer = {
    name: partner?.displayName ?? 'Partner',
    fallback: fallbackInitial(partner?.displayName ?? 'Partner'),
    imageUrl: partner?.avatarUrl,
    saved: partner?.saved ?? 0,
    target: partner?.target ?? target,
    themeColor: partner?.themeColor ?? ('teal' as const),
    isYou: false,
  };

  async function handleCreateBucket() {
    const nextTarget = Number(bucketTarget);
    if (!bucketCategory || !bucketName.trim() || nextTarget <= 0) {
      setMessage('Add a bucket name, target, and category.');
      return;
    }
    if (newBucketExceedsCapacity) {
      setMessage(`Bucket target exceeds remaining capacity. You have ${formatCurrency(bucketTargetRemaining ?? 0)} remaining for bucket targets.`);
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
    <div className="flex flex-col gap-6">
      {/* Project header. Compact, no heavy card. */}
      <header
        className="reveal-section flex items-end justify-between gap-3"
        style={revealStyle(0)}
      >
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Project
          </p>
          <h1 className="mt-1 truncate font-mono text-2xl font-bold text-ink">
            {activeRoom?.name ?? 'Japan 2027'}
          </h1>
        </div>
        {partnerEntry && (
          <NudgeButton
            partnerUserId={partnerEntry.userId}
            roomId={activeRoomId}
            partnerName={partnerEntry.displayName ?? 'Partner'}
          />
        )}
      </header>

      {/* 1 — Recorded Vault. Shared progress toward target. */}
      <div className="reveal-section" style={revealStyle(60)}>
        <TotalVaultCard saved={totalSaved} target={totalTarget} trendPct={weeklyTrendPct(logs)} />
      </div>

      {/* 2 — Progress Race (Head-to-Head). */}
      <div className="reveal-section" style={revealStyle(120)}>
        <HeadToHeadCard left={leftPlayer} right={rightPlayer} />
      </div>

      {/* 3 — Saving Plan island (with embedded Verified Balance). */}
      <div className="reveal-section" style={revealStyle(180)}>
        {reconciledAppBalance === null && verifiedBalanceSlot === null && (
          // Fallback row only when there is no Verified Balance to fold
          // into the Saving Plan island — kept lightweight so it still
          // doesn't compete with the Saving Plan headline.
          <div className="mb-3">
            <BalanceCheckStatus
              latest={latestCheckpoint}
              appBalance={0}
              onCheck={() => navigate('/check-balance')}
            />
          </div>
        )}
        <SavingPlanCard
          ruleType={activeRule}
          money={moneyStatus}
          habit={habitStatus}
          onConfigure={() => navigate('/saving-plan')}
          savedToday={savedToday}
          verifiedBalance={verifiedBalanceSlot}
          isPaused={isPausedToday}
          pausedSince={pausedSince}
          planSummary={planSummary}
        />
      </div>

      {/* (Next Win — hidden for now; component preserved.) */}
      {SHOW_NEXT_WIN && (
        <div className="reveal-section" style={revealStyle(220)}>
          <MicroGoalCard {...selectedBucket} />
        </div>
      )}

      {/* 4 — Smart Buckets. */}
      <div className="reveal-section flex flex-col gap-3" style={revealStyle(240)}>
        {hasPartnerBuckets && (
          <div className="flex items-center justify-end gap-2">
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
            <div>
              <p className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-brand-800">
                Smart Buckets
              </p>
              <h2 className="mt-1 font-mono text-2xl font-bold text-ink truncate">{partnerName}'s Buckets</h2>
              <p className="mt-1 font-mono text-sm text-ink-muted">
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
      </div>

      {/* 5 — Graphs. Lighter than the insight cards above. */}
      <div className="reveal-section flex flex-col gap-3" style={revealStyle(300)}>
        {planInsight && (
          <PlanInsightStrip week={planInsight.week} month={planInsight.month} />
        )}
        <MomentumChart
          series={dailyAmountSeries(logs, user?.id)}
          partnerSeries={partnerEntry ? dailyAmountSeries(logs, partnerEntry.userId) : undefined}
          labels={lastSevenDayLabels()}
          yourName={profile?.display_name ?? 'You'}
          partnerName={partnerEntry?.displayName ?? 'Partner'}
          expectedSeries={expectedDailySeries}
        />
        {SHOW_DEPOSIT_RACE && partnerEntry && (
          <SavingRaceSection
            logs={logs}
            buckets={[...buckets, ...partnerBuckets]}
            yourUserId={user?.id}
            partnerUserId={partnerEntry.userId}
            yourName={profile?.display_name ?? 'You'}
            partnerName={partnerEntry.displayName}
            activeRoomId={activeRoomId}
            expectedSeries={expectedCumulativeSeries}
          />
        )}
      </div>

      {/* 6 — Activity. Deposits and balance checks merged into one
              chronological list, top 3 items only. */}
      <section className="reveal-section flex flex-col gap-3" style={revealStyle(360)}>
        <div className="flex items-center justify-between gap-2">
          <SectionLabel tone="brand">Activity</SectionLabel>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="font-mono text-xs font-bold text-brand-800 active:scale-[0.98] transition-transform"
            >
              View all
            </button>
          )}
        </div>
        {mergedActivity.length > 0 ? (
          <div className="rounded-3xl bg-surface shadow-soft px-4 divide-y divide-well">
            {mergedActivity.map(item => (
              item.kind === 'deposit' ? (
                <ActivityTimelineRow
                  key={`d-${item.id}`}
                  actorName={item.actorName}
                  actorFallback={item.actorFallback}
                  bucketName={item.bucketName}
                  amount={item.amount}
                  occurredAt={item.occurredAt}
                  hasSlip={item.hasSlip}
                />
              ) : (
                <BalanceActivityRow key={`b-${item.id}`} entry={item.entry} />
              )
            ))}
          </div>
        ) : (
          <StatusCard title="No activity yet" body={`Start with ${formatCurrency(100)} and let the streak begin.`} />
        )}
        <ActivityHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          items={activityItems}
        />
      </section>

      <Modal open={bucketModalOpen} title="Add Bucket" onClose={() => setBucketModalOpen(false)}>
        <div className="flex flex-col gap-4">
          {message && <p className="rounded-2xl bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>}
          <CreateBucketForm
            category={bucketCategory}
            options={bucketOptions}
            name={bucketName}
            target={bucketTarget}
            targetHelper={bucketTargetRemaining !== null ? `${formatCurrency(bucketTargetRemaining)} remaining for bucket targets` : undefined}
            targetError={newBucketExceedsCapacity ? `This exceeds the remaining bucket target capacity by ${formatCurrency(newBucketTargetAmount - (bucketTargetRemaining ?? 0))}.` : undefined}
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

interface DepositActivityItem {
  id: string;
  actorName: string;
  actorFallback: string;
  bucketName: string;
  amount: number;
  occurredAt: string;
  hasSlip: boolean;
  slipUrl?: string | null;
}

type MergedActivity =
  | { kind: 'deposit'; id: string; at: string; actorName: string; actorFallback: string; bucketName: string; amount: number; occurredAt: string; hasSlip: boolean }
  | { kind: 'balance'; id: string; at: string; entry: BalanceActivityEntry };

function buildMergedActivity(
  deposits: DepositActivityItem[],
  balances: BalanceActivityEntry[],
  limit: number,
  currentUserId: string | undefined,
): MergedActivity[] {
  const dep: MergedActivity[] = deposits.map(d => ({
    kind: 'deposit',
    id: d.id,
    at: d.occurredAt,
    actorName: d.actorName,
    actorFallback: d.actorFallback,
    bucketName: d.bucketName,
    amount: d.amount,
    occurredAt: d.occurredAt,
    hasSlip: d.hasSlip,
  }));
  const bal: MergedActivity[] = balances.map(b => ({
    kind: 'balance',
    id: b.checkpoint_id,
    at: b.checked_at,
    entry: b,
  }));
  void currentUserId; // currentUserId is captured in row UI, not the merge
  return [...dep, ...bal]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, Math.max(1, limit));
}

/** One sanitized balance-check row inside the merged activity feed. */
function BalanceActivityRow({ entry }: { entry: BalanceActivityEntry }) {
  const matched = entry.difference_amount === 0;
  return (
    <div className="flex items-center gap-3 py-3">
      <IconBubble tone={matched ? 'peach' : 'muted'} size="md">
        {matched ? <IconCheck size={18} /> : <IconVault size={18} />}
      </IconBubble>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm text-ink">
          <span className="font-bold">{entry.display_name?.trim() || 'Partner'}</span>
          {matched
            ? ' checked balance — matched'
            : ` checked balance — ${formatSignedCurrency(entry.difference_amount)}`}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">
          {entry.reason ? `${reasonLabel(entry.reason)} · ` : ''}{formatRelativeTime(entry.checked_at)}
        </p>
      </div>
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

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in" aria-label="Loading dashboard">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20 rounded-pill" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3 w-36 rounded-pill" />
        </div>
        <Spinner size="sm" />
      </div>
      <section className="rounded-3xl bg-brand-50 p-5 shadow-soft">
        <Skeleton className="h-4 w-28 rounded-pill" />
        <Skeleton className="mt-4 h-8 w-3/4" />
        <Skeleton className="mt-3 h-3 w-1/2 rounded-pill" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </section>
    </div>
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
  /** Saving Plan expected cumulative for the same 7-day window. */
  expectedSeries?: number[];
}

/**
 * Renders the Deposit Race line chart with a bucket-scope filter. The
 * filter selection persists per room in localStorage so opening the
 * Dashboard later restores the previously-viewed scope.
 *
 * Expected Progress overlay is only meaningful in "All buckets" scope,
 * since the saving plan curve is room-wide. When a bucket scope is
 * selected the overlay is suppressed so the chart never compares two
 * different scopes silently.
 */
function SavingRaceSection({ logs, buckets, yourUserId, partnerUserId, yourName, partnerName, activeRoomId, expectedSeries }: SavingRaceSectionProps) {
  const storageKey = `saving-race-filter:${activeRoomId ?? 'no-room'}`;
  const [bucketFilter, setBucketFilter] = useLocalStorageState<string | null>(storageKey, null);
  const dedupedOptions = Array.from(new Map(buckets.map(b => [b.id, { id: b.id, name: b.name }])).values());
  const scopeBucket = buckets.find(b => b.id === bucketFilter) ?? null;
  const scopeLabel = scopeBucket ? `Scope: ${scopeBucket.name}` : 'All buckets';
  const yourSeries = cumulativeRaceSeries(logs, yourUserId, bucketFilter);
  const partnerSeries = cumulativeRaceSeries(logs, partnerUserId, bucketFilter);
  const overlay = bucketFilter === null ? expectedSeries : undefined;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-end">
        <SavingRaceFilter buckets={dedupedOptions} value={bucketFilter} onChange={setBucketFilter} />
      </div>
      <SavingRaceChart
        yourSeries={yourSeries}
        partnerSeries={partnerSeries}
        labels={lastSevenDayLabels()}
        yourName={yourName}
        partnerName={partnerName}
        scopeLabel={scopeLabel}
        expectedSeries={overlay}
      />
    </section>
  );
}

/** Sum of `savings_logs` amounts whose Bangkok date key falls in [startKey, endKey]. */
function recordedBetween(
  logs: ReturnType<typeof useLogs>['logs'],
  userId: string | undefined,
  startKey: string,
  endKey: string,
): number {
  if (!userId) return 0;
  return logs.reduce((sum, log) => {
    if (log.user_id !== userId) return sum;
    const key = todayBangkokKey(new Date(log.created_at));
    if (key < startKey || key > endKey) return sum;
    return sum + log.amount;
  }, 0);
}

/** Short human-readable plan rule summary for display in the Plan card. */
function buildPlanSummary(rev: SavingPlanRevision): string {
  switch (rev.rule_type) {
    case 'fixed_daily':
      return `Fixed daily · ${formatCurrency(Math.round(Number(rev.amount ?? 0)))}/day`;
    case 'fixed_weekly':
      return `Fixed weekly · ${formatCurrency(Math.round(Number(rev.amount ?? 0)))}/week`;
    case 'fixed_monthly':
      return `Fixed monthly · ${formatCurrency(Math.round(Number(rev.amount ?? 0)))}/month`;
    case 'increasing_daily':
      return `Increasing daily · starts ฿${Math.round(Number(rev.start_amount ?? 0))}`;
    case 'increasing_daily_capped':
      return `Increasing daily · capped at ${formatCurrency(Math.round(Number(rev.cap_amount ?? 0)))}`;
    default:
      return '';
  }
}

/** Sum of Saving Plan expected daily amounts in [startKey, endKey]. */
function expectedBetween(
  revisions: SavingPlanRevision[],
  startKey: string,
  endKey: string,
  pauses: SavingPlanPause[] = [],
): number {
  let total = 0;
  let cursor = startKey;
  let guard = 0;
  while (cursor <= endKey && guard < 366) {
    total += plannedAmountForDate(revisions, cursor, pauses);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return total;
}
