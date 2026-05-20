import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ActivityHistoryModal } from '../components/ActivityHistoryModal/ActivityHistoryModal';
import { ActivityTimelineRow } from '../components/ActivityTimelineRow/ActivityTimelineRow';
import { BalanceCheckStatus } from '../components/BalanceCheckStatus/BalanceCheckStatus';
import { SavingPlanCard } from '../components/SavingPlanCard/SavingPlanCard';
import { BucketRow } from '../components/BucketRow/BucketRow';
import { BucketGrid } from '../components/BucketGrid/BucketGrid';
import { BucketSheet } from '../components/BucketSheet/BucketSheet';
import { Button } from '../components/Button/Button';
import { CreateBucketForm } from '../components/CreateBucketForm/CreateBucketForm';
import { RoomLeaderboardList, type PlayerProgressEntry } from '../components/RoomLeaderboardList/RoomLeaderboardList';
import { IconBubble } from '../components/IconBubble/IconBubble';
import { MicroGoalCard } from '../components/MicroGoalCard/MicroGoalCard';
import { MomentumChart } from '../components/MomentumChart/MomentumChart';
import { TotalVaultCard } from '../components/TotalVaultCard/TotalVaultCard';
import { VerifiedBalanceReminderModal } from '../components/VerifiedBalanceReminderModal/VerifiedBalanceReminderModal';
import { NudgeButton } from '../components/NudgeButton/NudgeButton';
import { BellIconButton } from '../components/Notifications/BellIconButton';
import { useUnreadNotificationsCount } from '../hooks/useUnreadNotificationsCount';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
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
  IconUser,
  IconVault,
} from '../components/Icon/Icon';
import { Modal } from '../components/Modal/Modal';
import { OutcomeModal } from '../components/OutcomeModal/OutcomeModal';
import { SavingRaceChart } from '../components/SavingRaceChart/SavingRaceChart';
import { SavingRaceFilter } from '../components/SavingRaceFilter/SavingRaceFilter';
import { useAuth } from '../hooks/useAuth';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { useSharedData } from '../hooks/useSharedData';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { useLogs } from '../hooks/useLogs';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import { useSavingsTotal } from '../hooks/useSavingsTotal';
import { useI18n } from '../i18n/useI18n';
import { bucketSaved, sumTargets } from '../lib/buckets';
import { cumulativeRaceSeries } from '../lib/comparisonStats';
import { cumulativeAmountSeries, dailyAmountSeries, fallbackInitial, lastSevenDateKeys, lastSevenDayLabels } from '../lib/dashboardStats';
import { formatCurrency } from '../lib/format';
import { haptic } from '../lib/haptics';
import { daysSince, formatSignedCurrency } from '../lib/reconcile';
import {
  activeRevisionAt,
  habitStatusFromDeposits,
  isPausedOnDate,
  moneyStatusFor,
  nextUpcomingRevision,
  plannedAmountForDate,
  todayBangkokKey,
} from '../lib/savingPlan';
import type { SavingPlanRevision } from '../types';
import type { BalanceActivityEntry, Bucket, BucketCategory } from '../types';

/** Framer Motion stagger variants for the Dashboard cascade. */
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.18 },
  },
};

// Toggle to re-enable the "Next Win" micro-goal block without
// untangling its data preparation. Kept off-canvas while the
// Dashboard hierarchy focuses on Vault / Race / Plan.
const SHOW_NEXT_WIN = false;

// Session-scoped flag so the Verified Balance reminder popup does not
// respawn after a dismissal or after the user taps "Check now". Survives
// in-tab remounts; clears naturally when the browser tab closes.
const VB_REMINDER_SESSION_KEY = 'verifiedBalanceReminderDismissed';

// Old Deposit Race chart is hidden from the primary Dashboard while
// Daily Trend (MomentumChart) covers expected-vs-recorded. Component
// preserved for re-enablement.
const SHOW_DEPOSIT_RACE = false;

export function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { activeRoom, activeRoomId } = useRoom();
  const data = useSharedData();
  const { quickAmounts } = data.profile;
  const {
    personalGoalTarget,
    roomGoalTarget,
    loading: goalLoading,
    error: goalError,
  } = data.goal;
  useRooms();
  const { buckets, loading: bucketsLoading, saveBuckets } = data.buckets;
  const { logs, loading: logsLoading, error: logsError, insert } = data.logs;
  const { total } = useSavingsTotal(user?.id, logs);
  const leaderboard = data.leaderboard;
  const {
    latest: latestCheckpoint,
    activity: balanceActivity,
    appBalance: reconciledAppBalance,
    createCheckpoint,
    loading: reconcileLoading,
  } = data.reconcile;
  const { plan: savingPlan, deposits: planDeposits } = data.savingPlan;
  const {
    frozenDates: streakFrozenDates,
    lastFreezeDate: lastStreakFreezeDate,
  } = data.streakFreeze;
  const { count: unreadNotifications } = useUnreadNotificationsCount();
  const { copy, language, formatMoney } = useI18n();
  const d = copy.dashboard;
  const c = copy.common;

  // Task 32 plural fields — N-safe other-member data.
  const { memberIds: otherMemberIds } = data.otherMemberIds;
  const { bucketsByUser: roomMembersBucketsByUser } = data.roomMembersBuckets;
  // First other member by joined_at asc — deterministic source for the
  // legacy single-partner chart props (MomentumChart, BucketSheet
  // trendPreview). At N = 2 this equals today's `partnerEntry.userId`.
  const firstOtherMemberByJoinedAt = otherMemberIds[0] ?? null;
  const firstOtherEntry = firstOtherMemberByJoinedAt
    ? leaderboard.entries.find(entry => entry.userId === firstOtherMemberByJoinedAt) ?? null
    : null;
  // Bucket view: 'mine' or a member userId.
  const [bucketView, setBucketView] = useState<'mine' | string>('mine');
  const [expandedBucketId, setExpandedBucketId] = useState<string | null>(null);
  const [bucketModalOpen, setBucketModalOpen] = useState(false);
  const [bucketGoalOutcome, setBucketGoalOutcome] = useState<{ name: string; target: number } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [vbReminder, setVbReminder] = useState<{ open: boolean; days: number | null }>({ open: false, days: null });
  const vbReminderEvaluatedRef = useRef(false);
  const [bucketCategory, setBucketCategory] = useState<BucketCategory | null>('flight');
  const [bucketName, setBucketName] = useState('Flights');
  const [bucketTarget, setBucketTarget] = useState('30000');
  const [message, setMessage] = useState<string | null>(null);
  const bucketOptions = bucketOptionIcons.map(({ id, icon }) => ({
    id,
    icon,
    label: copy.bucket.categoryLabels[id],
  }));
  const loading = goalLoading || bucketsLoading || logsLoading || leaderboard.loading;
  const error = goalError ?? logsError;

  // Bucket view falls back to 'mine' whenever the selected other
  // member leaves the room, switches rooms, or empties out their
  // buckets. Guarded so the effect only fires when a stale selection
  // exists, preventing an unconditional set + re-render loop.
  useEffect(() => {
    if (bucketView === 'mine') return;
    const stillVisible = otherMemberIds.includes(bucketView)
      && (roomMembersBucketsByUser[bucketView]?.length ?? 0) > 0;
    if (!stillVisible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBucketView('mine');
      setExpandedBucketId(null);
    }
  }, [bucketView, otherMemberIds, roomMembersBucketsByUser]);

  // Verified balance reminder: open once per session when the last
  // check is ≥ 3 days old (or there has never been one). The session
  // flag survives in-tab navigation so the popup never respawns after
  // the user dismisses or starts a check. Plan type / streak are not
  // consulted — eligibility is purely date-based.
  useEffect(() => {
    if (vbReminderEvaluatedRef.current) return;
    if (loading || reconcileLoading) return;
    vbReminderEvaluatedRef.current = true;
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(VB_REMINDER_SESSION_KEY) === '1') return;
    const days = latestCheckpoint ? daysSince(latestCheckpoint.checked_at) : null;
    const eligible = days === null || days >= 3;
    if (!eligible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVbReminder({ open: true, days });
  }, [loading, reconcileLoading, latestCheckpoint]);

  function closeVbReminder() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(VB_REMINDER_SESSION_KEY, '1');
    }
    setVbReminder(prev => ({ ...prev, open: false }));
  }

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardStatusCard title={d.errorTitle} body={error} />;

  const you = leaderboard.entries.find(entry => entry.isYou);
  // Personal sub-goal drives this member's bucket capacity and member-row denominator.
  const target = personalGoalTarget ?? you?.personalGoalTarget ?? 0;
  const totalSaved = leaderboard.entries.reduce((sum, entry) => sum + entry.saved, 0);
  // Vault denominator is the room goal (Task 37). Fall back to the legacy
  // sum-of-personal-goals only while `rooms.target_amount` is still null
  // for an unbackfilled room.
  const legacySummedTargets = leaderboard.entries.reduce(
    (sum, entry) => sum + (entry.personalGoalTarget ?? 0),
    0,
  );
  const totalTarget = roomGoalTarget ?? (legacySummedTargets > 0 ? legacySummedTargets : target);
  const bucketTargetTotal = sumTargets(buckets);
  const bucketTargetRemaining = target > 0 ? Math.max(0, target - bucketTargetTotal) : null;
  const newBucketTargetAmount = Number(bucketTarget);
  const newBucketExceedsCapacity = bucketTargetRemaining !== null
    && Number.isFinite(newBucketTargetAmount)
    && newBucketTargetAmount > bucketTargetRemaining;
  const selectedBucket = bestMicroGoalBucket(buckets, logs, d, formatMoney);
  const bucketItems = buckets.map(bucket => ({
    id: bucket.id,
    icon: bucketIcon(bucket.category),
    name: bucket.name,
    saved: bucketSaved(bucket.id, logs),
    target: bucket.target_amount,
  })).sort((a, b) => {
    const pctA = a.target > 0 ? a.saved / a.target : 0;
    const pctB = b.target > 0 ? b.saved / b.target : 0;
    return pctB - pctA;
  });
  // Task 37: Manage Project is the only editing surface for both
  // the room goal and the personal sub-goal. Creators see an edit
  // affordance on the Vault card that navigates to /manage-project;
  // non-creators see no affordance at all.
  const isCreator = Boolean(user?.id && activeRoom?.created_by === user.id);

  // Per-member grouping for the buckets section. Order follows
  // `otherMemberIds` (joined_at asc) — stable across re-renders, unlike
  // leaderboard rank. Members with zero buckets are filtered out so the
  // tab disappears (matches today's `hasPartnerBuckets` gate).
  interface OtherMemberBucketGroup {
    userId: string;
    name: string;
    items: {
      id: string;
      icon: ReactNode;
      name: string;
      saved: number;
      target: number;
    }[];
  }
  const otherMemberBucketGroups: OtherMemberBucketGroup[] = otherMemberIds
    .map(userId => {
      const memberBuckets = roomMembersBucketsByUser[userId] ?? [];
      const entry = leaderboard.entries.find(e => e.userId === userId);
      const name = entry?.displayName ?? d.partnerLabel;
      const items = memberBuckets.map(bucket => ({
        id: bucket.id,
        icon: bucketIcon(bucket.category),
        name: bucket.name,
        saved: bucketSaved(bucket.id, logs),
        target: bucket.target_amount,
      }));
      return { userId, name, items };
    })
    .filter(group => group.items.length > 0);
  const activeOtherGroup = bucketView === 'mine'
    ? null
    : otherMemberBucketGroups.find(group => group.userId === bucketView) ?? null;
  const activityItems = logs.map(log => ({
    id: log.id,
    actorName: log.display_name ?? (log.user_id === user?.id ? profile?.display_name ?? d.youLabel : d.partnerLabel),
    actorFallback: fallbackInitial(log.display_name),
    bucketName: log.bucket_name ?? d.savingsFallback,
    amount: log.amount,
    occurredAt: log.created_at,
    hasSlip: Boolean(log.slip_url),
    slipUrl: log.slip_url,
  }));
  const hasOtherBuckets = otherMemberBucketGroups.length > 0;

  // Saving Plan status — computed once for the primary insight card.
  const todayKey = todayBangkokKey();
  // HOTFIX-007: use the same upcoming-first priority as the SavingPlan
  // edit page so the dashboard summary card shows the user's saved
  // upcoming revision (e.g. a future-start plan) instead of the
  // currently active one. Today's active revision is only needed for
  // accrual / history calculations which `moneyStatusFor` resolves
  // internally via `activeRevisionAt`.
  const displayRevision = savingPlan
    ? (nextUpcomingRevision(savingPlan.revisions, todayKey)
       ?? activeRevisionAt(savingPlan.revisions, todayKey))
    : null;
  // Today's active revision is kept for habit cadence checks (weekly /
  // monthly rules widen the "active" window). When no revision is
  // active yet the display revision provides a safe fallback.
  const accrualRevision = savingPlan
    ? (activeRevisionAt(savingPlan.revisions, todayKey) ?? displayRevision)
    : null;
  const planPauses = savingPlan?.pauses ?? [];
  const isPausedToday = savingPlan ? isPausedOnDate(planPauses, todayKey) : false;
  const openPause = planPauses.find(p => p.resumed_from === null) ?? null;
  const pausedSince = openPause?.paused_from ?? null;
  const planSummary = displayRevision ? buildPlanSummary(displayRevision, d) : null;
  // HOTFIX-008: when the displayRevision is a future-start revision
  // (effective_from_date > todayKey), compute moneyStatus against only
  // that single revision so the card reads "Not started" with
  // expectedToday = 0.  Using all revisions would leak the currently
  // active revision's accrual figures into the dashboard summary card.
  const displayIsFuture = displayRevision
    ? displayRevision.effective_from_date > todayKey
    : false;
  const moneyStatus = savingPlan
    ? moneyStatusFor(
        displayIsFuture && displayRevision
          ? [displayRevision]
          : savingPlan.revisions,
        displayIsFuture ? 0 : planDeposits.total,
        todayKey,
        planPauses,
      )
    : null;
  const habitStatus = habitStatusFromDeposits(
    accrualRevision?.rule_type ?? null,
    planDeposits.deposit_day_keys,
    todayKey,
    isPausedToday,
    streakFrozenDates,
  );

  // Saving Plan card meta — prefer the active plan revision's end date,
  // otherwise fall back to the room/goal end date. Some plans run in
  // target-reach mode (no revision end_date), so the room date is the
  // usual source.
  const planEndDateKey = displayRevision?.end_date ?? activeRoom?.end_date ?? null;
  const planDaysRemaining = planEndDateKey
    ? Math.max(
        0,
        Math.round(
          (Date.parse(planEndDateKey + 'T00:00:00Z') - Date.parse(todayKey + 'T00:00:00Z')) / 86_400_000,
        ),
      )
    : null;
  const planProgressPct = moneyStatus && moneyStatus.targetAmount > 0
    ? (moneyStatus.recordedDeposits / moneyStatus.targetAmount) * 100
    : 0;

  // Pack the Verified Balance slot for the Saving Plan island so
  // both ideas read as one financial picture; the underlying
  // BalanceCheckStatus card is only used as a fallback empty state.
  const checkpointDays = latestCheckpoint ? daysSince(latestCheckpoint.checked_at) : null;
  const verifiedSinceLabel = checkpointDays === null
    ? null
    : checkpointDays === 0
      ? c.today
      : c.daysAgoShort(checkpointDays);
  const verifiedBalanceSlot = reconciledAppBalance !== null
    ? {
        amount: reconciledAppBalance,
        sinceLabel: verifiedSinceLabel,
        matched: latestCheckpoint ? latestCheckpoint.difference_amount === 0 : false,
        diff: latestCheckpoint?.difference_amount ?? 0,
        onSubmit: async (actualAmount: number, reason?: Parameters<typeof createCheckpoint>[0]['reason']) => {
          const result = await createCheckpoint({ actualAmount, reason });
          if (!result.error) haptic(result.differenceAmount === 0 ? 'success' : 'milestone');
          return result;
        },
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
  // Daily Deposit Trend secondary series.
  // - 2-user rooms keep the existing single-partner series so the
  //   chart reads as a direct head-to-head.
  // - 3-7 member rooms aggregate every other member's daily totals
  //   into a single "Others (N)" series so the mobile chart isn't
  //   asked to render seven full names inline. Per Task 38, the
  //   aggregate is for display only and does not feed Saving Plan
  //   math or deposit writes.
  const otherMembersCount = otherMemberIds.length;
  const useAggregateOthers = otherMembersCount >= 2;
  const chartOthersDailySeries = otherMembersCount === 0
    ? undefined
    : useAggregateOthers
      ? otherMemberIds
          .map(id => dailyAmountSeries(logs, id))
          .reduce<number[]>(
            (acc, series) => acc.map((value, index) => value + (series[index] ?? 0)),
            [0, 0, 0, 0, 0, 0, 0],
          )
      : (firstOtherMemberByJoinedAt
          ? dailyAmountSeries(logs, firstOtherMemberByJoinedAt)
          : undefined);
  const chartOthersLabel = otherMembersCount === 0
    ? undefined
    : useAggregateOthers
      ? d.othersLabel(otherMembersCount)
      : (firstOtherEntry?.displayName ?? d.partnerLabel);
  const weekRecordedTotal = dailyAmountSeries(logs, user?.id).reduce((sum, v) => sum + v, 0);
  const weekExpectedTotal = expectedDailySeries
    ? expectedDailySeries.reduce((sum, v) => sum + v, 0)
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

  const youName = you?.displayName ?? profile?.display_name ?? d.youLabel;
  // Leader-first list for the N-aware Progress Race. When the caller
  // is the only member, we synthesise their row from profile/total so
  // the section still renders before any partner has joined.
  const leaderboardEntries: PlayerProgressEntry[] = leaderboard.entries.length > 0
    ? leaderboard.entries.map(entry => ({
        userId: entry.userId,
        name: entry.isYou ? youName : (entry.displayName ?? d.partnerLabel),
        fallback: fallbackInitial(entry.displayName ?? (entry.isYou ? profile?.display_name : d.partnerLabel)),
        imageUrl: entry.avatarUrl,
        saved: entry.saved,
        // Task 37: each row's denominator is that member's personal
        // sub-goal. Only the current user's row falls back to the
        // resolved personal target — other members with a missing
        // personal goal row render with 0 rather than borrowing this
        // user's target.
        target: entry.target ?? (entry.isYou ? target : 0),
        themeColor: entry.themeColor,
        isYou: entry.isYou,
      }))
    : (user?.id ? [{
        userId: user.id,
        name: youName,
        fallback: fallbackInitial(profile?.display_name),
        imageUrl: profile?.avatar_url ?? null,
        saved: total,
        target,
        themeColor: profile?.theme_color,
        isYou: true,
      }] : []);

  const chartLocale = language === 'th' ? 'th-TH' : 'en-US';

  async function handleCreateBucket() {
    const nextTarget = Number(bucketTarget);
    if (!bucketCategory || !bucketName.trim() || nextTarget <= 0) {
      setMessage(copy.bucket.validationNameAndTarget);
      return;
    }
    if (newBucketExceedsCapacity) {
      setMessage(copy.bucket.capacityError(formatMoney(bucketTargetRemaining ?? 0)));
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
    <>
      {createPortal(
        <div aria-hidden className="dashboard-mesh-bg pointer-events-none fixed inset-0 -z-10" />,
        document.body,
      )}
    <motion.div className="flex flex-col gap-6" variants={containerVariants} initial="hidden" animate="visible">
      {/* Project header. Compact, no heavy card. */}
      <motion.header
        className="flex items-start justify-between gap-3"
        variants={sectionVariants}
      >
        <div className="min-w-0 flex-1">
          <h1 className="max-w-full break-words font-mono text-2xl font-bold leading-tight text-ink line-clamp-2">
            {activeRoom?.name ?? 'Japan 2027'}
          </h1>
          <div className="mt-1 flex items-center gap-1.5 text-ink-muted">
            <IconUser size={14} />
            <span className="font-mono text-xs">
              {d.membersInRoom(leaderboard.entries.length)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BellIconButton
            unreadCount={unreadNotifications}
            onClick={() => navigate('/notifications')}
          />
        </div>
      </motion.header>

      {/* 1 — Recorded Vault. Shared progress toward target. */}
      <motion.div variants={sectionVariants}>
        <TotalVaultCard
          saved={totalSaved}
          target={totalTarget}
          onEdit={isCreator ? () => navigate('/manage-project') : undefined}
          editAriaLabel={isCreator ? d.goalEditAria : undefined}
        />
      </motion.div>

      {/* 2 — Progress Race (N-aware leaderboard). */}
      <motion.div variants={sectionVariants}>
        <RoomLeaderboardList
          entries={leaderboardEntries}
          emptyBody={d.invitePartnerHint}
          renderRowTrailing={entry => (
            <NudgeButton
              partnerUserId={entry.userId}
              roomId={activeRoomId}
              partnerName={entry.name}
            />
          )}
          onRowClick={entry => {
            if (entry.isYou) {
              navigate('/profile');
              return;
            }
            navigate(`/members/${entry.userId}`);
          }}
        />
      </motion.div>

      {/* 3 — Saving Plan island (with embedded Verified Balance). */}
      <motion.div variants={sectionVariants}>
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
          ruleType={displayRevision?.rule_type ?? null}
          money={moneyStatus}
          habit={habitStatus}
          onConfigure={() => navigate('/saving-plan')}
          verifiedBalance={verifiedBalanceSlot}
          isPaused={isPausedToday}
          pausedSince={pausedSince}
          planSummary={planSummary}
          lastFreezeDateKey={lastStreakFreezeDate}
          todayDateKey={todayKey}
          planStartDateKey={displayRevision?.effective_from_date ?? null}
          daysRemaining={planDaysRemaining}
          progressPct={planProgressPct}
        />
      </motion.div>

      {/* (Next Win — hidden for now; component preserved.) */}
      {SHOW_NEXT_WIN && (
        <motion.div variants={sectionVariants}>
          <MicroGoalCard {...selectedBucket} />
        </motion.div>
      )}

      {/* 4 — Smart Buckets. */}
      <motion.div className="flex flex-col gap-3" variants={sectionVariants}>
        {hasOtherBuckets && (
          <BucketMemberPicker
            ariaLabel={d.switchBucketOwner}
            options={[
              {
                value: 'mine',
                label: d.youLabel,
                themeColor: profile?.theme_color ?? null,
              },
              ...otherMemberBucketGroups.map(group => {
                const entry = leaderboard.entries.find(e => e.userId === group.userId);
                return {
                  value: group.userId,
                  label: group.name,
                  themeColor: entry?.themeColor ?? null,
                };
              }),
            ]}
            value={bucketView}
            onChange={next => {
              setBucketView(next);
              setExpandedBucketId(null);
            }}
          />
        )}
        {activeOtherGroup ? (
          <BucketGrid
            title={d.yourBuckets(activeOtherGroup.name)}
            subtitle={`${d.bucketCount(activeOtherGroup.items.length)} — ${d.bucketReadOnly}`}
            buckets={activeOtherGroup.items}
            renderBucket={bucket => (
              <BucketRow
                icon={bucket.icon}
                name={bucket.name}
                saved={bucket.saved}
                target={bucket.target}
              />
            )}
          />
        ) : (
          <BucketGrid
            title={d.tripBuckets}
            subtitle={buckets.length > 0 ? d.bucketCount(buckets.length) : undefined}
            buckets={bucketItems}
            ctaLabel={buckets.length > 0 ? d.addBucket : d.createBucket}
            onAddBucket={() => setBucketModalOpen(true)}
            renderBucket={bucket => (
              <BucketRow
                icon={bucket.icon}
                name={bucket.name}
                saved={bucket.saved}
                target={bucket.target}
                onClick={() => setExpandedBucketId(bucket.id)}
              />
            )}
          />
        )}
        {buckets.length === 0 && (
          <Button variant="action" fullWidth onClick={() => setBucketModalOpen(true)}>
            {d.createFirstBucket}
          </Button>
        )}
        {message && <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>}
      </motion.div>

      {/* 5 — Graphs. Lighter than the insight cards above. */}
      <motion.div className="flex flex-col gap-3" variants={sectionVariants}>
        <MomentumChart
          series={dailyAmountSeries(logs, user?.id)}
          partnerSeries={chartOthersDailySeries}
          labels={lastSevenDayLabels(undefined, chartLocale)}
          yourName={profile?.display_name ?? d.youLabel}
          partnerName={chartOthersLabel}
          expectedSeries={expectedDailySeries}
          todayIndex={6}
          weekTotal={weekRecordedTotal}
          weekExpected={weekExpectedTotal}
        />
        {SHOW_DEPOSIT_RACE && firstOtherMemberByJoinedAt && (
          <SavingRaceSection
            logs={logs}
            buckets={[...buckets, ...data.roomMembersBuckets.allBuckets]}
            yourUserId={user?.id}
            partnerUserId={firstOtherMemberByJoinedAt}
            yourName={profile?.display_name ?? d.youLabel}
            partnerName={firstOtherEntry?.displayName ?? d.partnerLabel}
            activeRoomId={activeRoomId}
            expectedSeries={expectedCumulativeSeries}
          />
        )}
      </motion.div>

      {/* 6 — Activity. Deposits and balance checks merged into one
              chronological list, top 3 items only. */}
      <motion.section className="flex flex-col gap-3" variants={sectionVariants}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-mono text-lg font-bold leading-tight text-ink">{d.activity}</h2>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="font-mono text-xs font-bold text-brand-800 active:scale-[0.98] transition-transform"
            >
              {d.viewAll}
            </button>
          )}
        </div>
        {mergedActivity.length > 0 ? (
          <div className="rounded-xl bg-surface shadow-soft px-4 divide-y divide-well">
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
          <DashboardStatusCard title={d.noActivityYet} body={d.noActivityBody(formatMoney(100))} />
        )}
        <ActivityHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          items={activityItems}
        />
      </motion.section>

      <Modal open={bucketModalOpen} title={d.addBucketModalTitle} onClose={() => setBucketModalOpen(false)}>
        <div className="flex flex-col gap-4">
          {message && <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>}
          <CreateBucketForm
            category={bucketCategory}
            options={bucketOptions}
            name={bucketName}
            target={bucketTarget}
            targetHelper={bucketTargetRemaining !== null ? copy.bucket.remainingForBuckets(formatMoney(bucketTargetRemaining)) : undefined}
            targetError={newBucketExceedsCapacity ? copy.bucket.capacityExceededBy(formatMoney(newBucketTargetAmount - (bucketTargetRemaining ?? 0))) : undefined}
            onCategoryChange={setBucketCategory}
            onNameChange={setBucketName}
            onTargetChange={value => setBucketTarget(value.replace(/[^0-9]/g, ''))}
            onSubmit={handleCreateBucket}
          />
        </div>
      </Modal>

      <VerifiedBalanceReminderModal
        open={vbReminder.open}
        daysSinceLast={vbReminder.days}
        onClose={closeVbReminder}
        onCheckNow={() => {
          closeVbReminder();
          navigate('/check-balance');
        }}
      />

      {/* Bucket deposit bottom sheet */}
      {(() => {
        const selectedBucketItem = bucketItems.find(b => b.id === expandedBucketId);
        return (
          <BucketSheet
            open={Boolean(expandedBucketId)}
            onClose={() => setExpandedBucketId(null)}
            icon={selectedBucketItem?.icon ?? null}
            name={selectedBucketItem?.name ?? ''}
            saved={selectedBucketItem?.saved ?? 0}
            target={selectedBucketItem?.target ?? 0}
            quickAmounts={quickAmounts}
            trendPreview={{
              mineLabel: profile?.display_name ?? d.youLabel,
              theirLabel: firstOtherEntry?.displayName ?? copy.addMoney.partnerLabel,
              mineSeries: pending => cumulativeAmountSeries(logs, user?.id, pending),
              theirSeries: cumulativeAmountSeries(logs, firstOtherMemberByJoinedAt ?? undefined),
            }}
            onConfirm={async amount => {
              if (!expandedBucketId) return { error: copy.bucket.validationNameAndTarget };
              const prev = selectedBucketItem?.saved ?? 0;
              const result = await insert(amount, expandedBucketId);
              if (!result.error) {
                const reached = prev < (selectedBucketItem?.target ?? 0) && prev + amount >= (selectedBucketItem?.target ?? 0);
                haptic(reached ? 'milestone' : 'success');
                if (reached && selectedBucketItem) {
                  setBucketGoalOutcome({ name: selectedBucketItem.name, target: selectedBucketItem.target });
                }
              }
              return result;
            }}
          />
        );
      })()}
      <OutcomeModal
        open={Boolean(bucketGoalOutcome)}
        outcome="success"
        icon={<IconCheck size={28} />}
        title={copy.addMoney.bucketReachedTitle}
        body={
          bucketGoalOutcome
            ? copy.addMoney.bucketReachedBody(bucketGoalOutcome.name, formatMoney(bucketGoalOutcome.target))
            : undefined
        }
      >
        <Button variant="action" fullWidth onClick={() => setBucketGoalOutcome(null)}>
          {copy.addMoney.outcomeDone}
        </Button>
      </OutcomeModal>
    </motion.div>
    </>
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
  const { copy, formatRelativeTime } = useI18n();
  const d = copy.dashboard;
  const matched = entry.difference_amount === 0;
  return (
    <div className="flex items-center gap-3 py-3">
      <IconBubble tone={matched ? 'peach' : 'muted'} size="md">
        {matched ? <IconCheck size={18} /> : <IconVault size={18} />}
      </IconBubble>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm text-ink">
          <span className="font-bold">{entry.display_name?.trim() || d.partnerLabel}</span>
          {' '}
          {matched
            ? d.checkedBalanceMatched
            : d.checkedBalanceDiff(formatSignedCurrency(entry.difference_amount))}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">
          {entry.reason ? `${copy.reconcile.reasons[entry.reason].label} · ` : ''}{formatRelativeTime(entry.checked_at)}
        </p>
      </div>
    </div>
  );
}

function DashboardStatusCard({ title, body }: { title: string; body: string }) {
  const { copy } = useI18n();
  return (
    <section className="rounded-xl bg-surface p-5 shadow-soft">
      <SectionLabel tone="brand">{copy.nav.dashboard}</SectionLabel>
      <h1 className="mt-2 font-mono text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 font-mono text-xs text-ink-muted">{body}</p>
    </section>
  );
}

function DashboardSkeleton() {
  const { copy } = useI18n();
  return (
    <div className="flex flex-col gap-6 animate-fade-in" aria-label={copy.common.loadingDashboard}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20 rounded-pill" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3 w-36 rounded-pill" />
        </div>
        <Spinner size="sm" tone="neutral" />
      </div>
      <section className="rounded-xl bg-brand-50 p-5 shadow-soft">
        <Skeleton className="h-4 w-28 rounded-pill" />
        <Skeleton className="mt-4 h-8 w-3/4" />
        <Skeleton className="mt-3 h-3 w-1/2 rounded-pill" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-36 rounded-pill" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </section>
    </div>
  );
}

function bestMicroGoalBucket(
  buckets: Bucket[],
  logs: ReturnType<typeof useLogs>['logs'],
  copy: ReturnType<typeof useI18n>['copy']['dashboard'],
  formatMoney: (amount: number) => string,
) {
  const bucket = buckets
    .map(item => ({ bucket: item, saved: bucketSaved(item.id, logs) }))
    .sort((a, b) => (a.bucket.target_amount - a.saved) - (b.bucket.target_amount - b.saved))[0];

  if (!bucket) {
    return {
      icon: <IconRocket size={26} />,
      title: copy.firstBucketTitle,
      remaining: 0,
      pct: 0,
      subtitle: copy.firstBucketSubtitle,
    };
  }

  return {
    icon: bucketIcon(bucket.bucket.category),
    title: bucket.bucket.name,
    remaining: Math.max(0, bucket.bucket.target_amount - bucket.saved),
    pct: bucket.bucket.target_amount > 0 ? Math.min(100, Math.round((bucket.saved / bucket.bucket.target_amount) * 100)) : 0,
    subtitle: copy.savedLabel(formatMoney(bucket.saved)),
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

interface BucketMemberPickerOption {
  value: string;
  label: string;
  themeColor?: string | null;
}

interface BucketMemberPickerProps {
  ariaLabel: string;
  options: BucketMemberPickerOption[];
  value: string;
  onChange: (next: string) => void;
}

/** Dashboard-scoped horizontal member picker for the Smart Buckets
 *  section. Replaces the right-aligned `Segmented` control so 3-7
 *  member rooms can scroll cleanly on mobile without clipping the
 *  first option, wrapping tab labels, or detaching from the bucket
 *  section. Selection state mirrors the previous tab-pill look. */
function BucketMemberPicker({ ariaLabel, options, value, onChange }: BucketMemberPickerProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="-mx-2 flex items-center gap-2 overflow-x-auto px-2 pb-1"
    >
      {options.map(option => {
        const active = option.value === value;
        const dotColor = option.themeColor ?? '#F26B1A';
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={
              'inline-flex shrink-0 items-center gap-2 rounded-pill px-3.5 py-2 font-mono text-xs font-bold transition-all '
              + (active
                ? 'bg-brand-500 text-ink-inverse shadow-haloOrange'
                : 'bg-well text-ink-muted shadow-neuPressed')
            }
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: dotColor,
                opacity: active ? 0.85 : 1,
              }}
            />
            <span className="max-w-[8rem] truncate whitespace-nowrap">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const bucketOptionIcons = [
  { id: 'flight' as const, icon: <IconPlane size={22} /> },
  { id: 'accom' as const, icon: <IconBed size={22} /> },
  { id: 'dining' as const, icon: <IconFork size={22} /> },
  { id: 'activities' as const, icon: <IconTicket size={22} /> },
  { id: 'gear' as const, icon: <IconSmartphone size={22} /> },
  { id: 'home' as const, icon: <IconHome size={22} /> },
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
  const { copy } = useI18n();
  const storageKey = `saving-race-filter:${activeRoomId ?? 'no-room'}`;
  const [bucketFilter, setBucketFilter] = useLocalStorageState<string | null>(storageKey, null);
  const dedupedOptions = Array.from(new Map(buckets.map(b => [b.id, { id: b.id, name: b.name }])).values());
  const scopeBucket = buckets.find(b => b.id === bucketFilter) ?? null;
  const scopeLabel = scopeBucket ? copy.dashboard.scopeBucket(scopeBucket.name) : copy.dashboard.scopeAllBuckets;
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

interface PlanSummaryMessages {
  planFixedDaily: (amount: string) => string;
  planFixedWeekly: (amount: string) => string;
  planFixedMonthly: (amount: string) => string;
  planIncreasingDaily: (startAmount: string) => string;
  planIncreasingDailyCapped: (capAmount: string) => string;
}

/** Short human-readable plan rule summary for display in the Plan card. */
function buildPlanSummary(rev: SavingPlanRevision, msg: PlanSummaryMessages): string {
  switch (rev.rule_type) {
    case 'fixed_daily':
      return msg.planFixedDaily(formatCurrency(Math.round(Number(rev.amount ?? 0))));
    case 'fixed_weekly':
      return msg.planFixedWeekly(formatCurrency(Math.round(Number(rev.amount ?? 0))));
    case 'fixed_monthly':
      return msg.planFixedMonthly(formatCurrency(Math.round(Number(rev.amount ?? 0))));
    case 'increasing_daily':
      return msg.planIncreasingDaily(String(Math.round(Number(rev.start_amount ?? 0))));
    case 'increasing_daily_capped':
      return msg.planIncreasingDailyCapped(formatCurrency(Math.round(Number(rev.cap_amount ?? 0))));
    default:
      return '';
  }
}
