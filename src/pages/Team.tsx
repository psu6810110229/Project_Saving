import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ActivityHistoryModal } from '../components/ActivityHistoryModal/ActivityHistoryModal';
import { ActivityTimelineRow } from '../components/ActivityTimelineRow/ActivityTimelineRow';
import { Avatar } from '../components/Avatar/Avatar';
import { Button } from '../components/Button/Button';
import { useToast } from '../components/InAppToast/InAppToastProvider';
import { IconBubble } from '../components/IconBubble/IconBubble';
import { MomentumChart } from '../components/MomentumChart/MomentumChart';
import { MomentumPurposePicker } from '../components/MomentumPurposePicker/MomentumPurposePicker';
import { TeamSection, type TeamSectionMember } from '../components/TeamSection/TeamSection';
import { MemberDetailModal, type MemberDetailModalMember } from '../components/MemberDetailModal/MemberDetailModal';
import { PullToRefresh } from '../components/PullToRefresh/PullToRefresh';
import { SavingRaceChart } from '../components/SavingRaceChart/SavingRaceChart';
import { SavingRaceFilter } from '../components/SavingRaceFilter/SavingRaceFilter';
import {
  IconArrowRight,
  IconBell,
  IconCheck,
  IconChevronDown,
  IconTrash,
  IconVault,
} from '../components/Icon/Icon';
import { useAuth } from '../hooks/useAuth';
import { useSharedData } from '../hooks/useSharedData';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { useLogs } from '../hooks/useLogs';
import { useMemberSavingSnapshot } from '../hooks/useMemberSavingSnapshot';
import { useRoom } from '../hooks/useRoom';
import { useSendNudge } from '../hooks/useSendNudge';
import { useI18n } from '../i18n/useI18n';
import { bucketSaved } from '../lib/buckets';
import { cumulativeRaceSeries } from '../lib/comparisonStats';
import { fallbackInitial, lastSevenDateKeys, lastSevenDayLabels } from '../lib/dashboardStats';
import {
  availablePurposeCategoriesForModeFromFlows,
  purposeVisibleFlowDailyMarkers,
  purposeVisibleFlowDailySeries,
  type MomentumPurposeScope,
} from '../lib/momentumPurpose';
import { haptic } from '../lib/haptics';
import { formatDirectionalAdjustment } from '../lib/reconcile';
import { plannedAmountForDate, todayBangkokKey } from '../lib/savingPlan';
import { useAmbientMotionReady } from '../lib/animationBudget';
import type { BalanceActivityEntry, Bucket, ProfileTheme } from '../types';
import type { BucketActivityEvent } from '../hooks/useBucketActivityEvents';

type DailyTrendMode = 'room' | 'me' | 'compare';

// Old Deposit Race chart is kept off-canvas while the MomentumChart
// covers expected-vs-recorded. Component preserved for re-enablement.
const SHOW_DEPOSIT_RACE = false;

/**
 * Team — group/social hub. Holds the leaderboard, momentum chart, and the
 * room activity feed. Member rows link to the per-member detail view, where
 * the nudge action lives. Data is read from the shared data context, the
 * same source the Dashboard uses.
 */
export function Team() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, profile } = useAuth();
  const { activeRoomId } = useRoom();
  const { copy, language, formatMoney } = useI18n();
  const { sendNudge } = useSendNudge();
  const d = copy.dashboard;

  const data = useSharedData();
  const { buckets } = data.buckets;
  const { transfers: bucketTransfers } = data.bucketTransfers;
  const { allocations: balanceAllocations } = data.balanceAllocations;
  const { logs } = data.logs;
  const { flows: visibleMomentumFlows } = data.roomVisibleMomentumFlows;
  const leaderboard = data.leaderboard;
  const { events: bucketActivityEvents } = data.bucketActivityEvents;
  const { activity: balanceActivity } = data.reconcile;
  const { plan: savingPlan } = data.savingPlan;
  const { personalGoalTarget } = data.goal;
  const { memberIds: otherMemberIds } = data.otherMemberIds;
  const { refreshAll } = data;
  const currentUserId = user?.id;

  const total = useMemo(
    () => logs.filter(log => log.user_id === currentUserId).reduce((sum, log) => sum + log.amount, 0),
    [currentUserId, logs],
  );

  const you = useMemo(() => leaderboard.entries.find(entry => entry.isYou), [leaderboard.entries]);
  const target = personalGoalTarget ?? you?.personalGoalTarget ?? 0;
  const totalSaved = useMemo(
    () => leaderboard.entries.reduce((sum, entry) => sum + entry.saved, 0),
    [leaderboard.entries],
  );
  const legacySummedTargets = useMemo(
    () => leaderboard.entries.reduce((sum, entry) => sum + (entry.personalGoalTarget ?? 0), 0),
    [leaderboard.entries],
  );
  const totalTarget = legacySummedTargets > 0 ? legacySummedTargets : target;

  const firstOtherMemberByJoinedAt = otherMemberIds[0] ?? null;
  const firstOtherEntry = useMemo(
    () => (firstOtherMemberByJoinedAt
      ? leaderboard.entries.find(entry => entry.userId === firstOtherMemberByJoinedAt) ?? null
      : null),
    [firstOtherMemberByJoinedAt, leaderboard.entries],
  );

  // Daily Deposit Trend mode. Default `room` so 3-7 member rooms read as a
  // room total; 2-user rooms still show a clear room/me/compare experience.
  const [trendMode, setTrendMode] = useState<DailyTrendMode>('room');
  const [purposeScope, setPurposeScope] = useState<MomentumPurposeScope>({ kind: 'all' });
  const allVisibleBuckets = useMemo(
    () => [...buckets, ...data.roomMembersBuckets.allBuckets],
    [buckets, data.roomMembersBuckets.allBuckets],
  );
  const visibleBucketsById = useMemo(() => new Map<string, Bucket>(
    allVisibleBuckets.map(b => [b.id, b]),
  ), [allVisibleBuckets]);
  const [compareMemberId, setCompareMemberId] = useState<string | null>(null);
  const effectiveTrendMode: DailyTrendMode = purposeScope.kind === 'bucket' ? 'me' : trendMode;
  const purposeCategories = useMemo(
    () => availablePurposeCategoriesForModeFromFlows(
      effectiveTrendMode,
      buckets,
      allVisibleBuckets,
      visibleMomentumFlows,
      visibleBucketsById,
      compareMemberId,
      currentUserId,
    ),
    [effectiveTrendMode, buckets, allVisibleBuckets, visibleMomentumFlows, visibleBucketsById, compareMemberId, currentUserId],
  );
  const purposePickerBuckets = effectiveTrendMode === 'me' ? buckets : allVisibleBuckets;
  const chartTodayKey = todayBangkokKey();
  const chartToday = useMemo(() => new Date(`${chartTodayKey}T12:00:00+07:00`), [chartTodayKey]);
  const chartDayKeys = useMemo(() => lastSevenDateKeys(chartToday), [chartToday]);
  const chartLocale = language === 'th' ? 'th-TH' : 'en-US';
  const chartLabels = useMemo(
    () => lastSevenDayLabels(chartToday, chartLocale),
    [chartLocale, chartToday],
  );

  // Keep `compareMemberId` aligned with the current `otherMemberIds`.
  useEffect(() => {
    if (otherMemberIds.length === 0) {
      if (compareMemberId !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCompareMemberId(null);
      }
      if (trendMode === 'compare') {
        setTrendMode('room');
      }
      return;
    }
    if (!compareMemberId || !otherMemberIds.includes(compareMemberId)) {
      setCompareMemberId(otherMemberIds[0]);
    }
  }, [otherMemberIds, compareMemberId, trendMode]);

  useEffect(() => {
    if (purposeScope.kind === 'category') {
      if (!purposeCategories.includes(purposeScope.category)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPurposeScope({ kind: 'all' });
      }
    } else if (purposeScope.kind === 'categories') {
      if (purposeScope.categories.some(category => !purposeCategories.includes(category))) {
        setPurposeScope({ kind: 'all' });
      }
    } else if (purposeScope.kind === 'bucket') {
      if (
        !visibleBucketsById.has(purposeScope.bucketId)
        || !purposeCategories.includes(purposeScope.parentCategory)
      ) {
        setPurposeScope({ kind: 'all' });
      }
    }
  }, [purposeScope, purposeCategories, visibleBucketsById]);

  // Activity feed — deposits + balance checks + bucket events, top 3.
  const activityItems = useMemo(() => logs.map(log => ({
    id: log.id,
    actorName: log.display_name ?? (log.user_id === currentUserId ? profile?.display_name ?? d.youLabel : d.partnerLabel),
    actorFallback: fallbackInitial(log.display_name),
    bucketName: log.bucket_name ?? d.savingsFallback,
    amount: log.amount,
    occurredAt: log.created_at,
    hasSlip: Boolean(log.slip_url),
    slipUrl: log.slip_url,
  })), [currentUserId, logs, profile?.display_name, d.youLabel, d.partnerLabel, d.savingsFallback]);

  const bucketEventItems = useMemo(() => {
    const resolveActor = (actorUserId: string | null) => {
      if (!actorUserId) return { name: d.partnerLabel, fallback: fallbackInitial(undefined), avatar: null as string | null | undefined };
      if (actorUserId === currentUserId) return { name: profile?.display_name ?? d.youLabel, fallback: fallbackInitial(profile?.display_name), avatar: profile?.avatar_url };
      const entry = leaderboard.entries.find(e => e.userId === actorUserId);
      return { name: entry?.displayName ?? d.partnerLabel, fallback: fallbackInitial(entry?.displayName), avatar: entry?.avatarUrl };
    };
    return bucketActivityEvents.map(event => {
      const actor = resolveActor(event.actor_user_id);
      return { event, actorName: actor.name, actorFallback: actor.fallback, actorAvatarUrl: actor.avatar };
    });
  }, [bucketActivityEvents, leaderboard.entries, currentUserId, profile?.display_name, profile?.avatar_url, d.youLabel, d.partnerLabel]);

  const mergedActivity = useMemo(() => buildMergedActivity(
    activityItems,
    balanceActivity,
    bucketEventItems,
    3,
    currentUserId,
  ), [activityItems, balanceActivity, bucketEventItems, currentUserId]);

  // Saving Plan chart overlays: per-day Expected Progress aligned to the
  // same 7-day window the deposit charts use (Recorded vs Expected only).
  const revisions = savingPlan?.revisions ?? null;
  const planPauses = useMemo(() => savingPlan?.pauses ?? [], [savingPlan?.pauses]);
  const expectedDailySeries = useMemo(
    () => (revisions
      ? chartDayKeys.map(key => plannedAmountForDate(revisions, key, planPauses))
      : undefined),
    [chartDayKeys, planPauses, revisions],
  );

  const meDailySeries = useMemo(() => purposeVisibleFlowDailySeries(
      visibleMomentumFlows,
      purposeScope,
      visibleBucketsById,
      currentUserId,
      chartToday,
    ), [chartToday, currentUserId, purposeScope, visibleBucketsById, visibleMomentumFlows]);
  const meDailyMarkers = useMemo(() => purposeVisibleFlowDailyMarkers(
      visibleMomentumFlows,
      purposeScope,
      visibleBucketsById,
      currentUserId,
      chartToday,
      { revealBucketNamesForUserId: currentUserId ?? null },
    ), [chartToday, currentUserId, purposeScope, visibleBucketsById, visibleMomentumFlows]);
  const otherDailySeriesByUserId = useMemo(() => otherMemberIds.reduce<Record<string, number[]>>((acc, id) => {
    acc[id] = purposeVisibleFlowDailySeries(visibleMomentumFlows, purposeScope, visibleBucketsById, id, chartToday);
    return acc;
  }, {}), [chartToday, otherMemberIds, purposeScope, visibleBucketsById, visibleMomentumFlows]);
  const otherDailyMarkersByUserId = useMemo(() => otherMemberIds.reduce<Record<string, ReturnType<typeof purposeVisibleFlowDailyMarkers>>>((acc, id) => {
    acc[id] = purposeVisibleFlowDailyMarkers(
      visibleMomentumFlows,
      purposeScope,
      visibleBucketsById,
      id,
      chartToday,
      { revealBucketNamesForUserId: null },
    );
    return acc;
  }, {}), [chartToday, otherMemberIds, purposeScope, visibleBucketsById, visibleMomentumFlows]);
  const roomDailySeries = useMemo(() => purposeVisibleFlowDailySeries(
      visibleMomentumFlows,
      purposeScope,
      visibleBucketsById,
      undefined,
      chartToday,
    ), [chartToday, purposeScope, visibleBucketsById, visibleMomentumFlows]);
  const roomDailyMarkers = useMemo(() => purposeVisibleFlowDailyMarkers(
      visibleMomentumFlows,
      purposeScope,
      visibleBucketsById,
      undefined,
      chartToday,
      { revealBucketNamesForUserId: currentUserId ?? null },
    ), [chartToday, currentUserId, purposeScope, visibleBucketsById, visibleMomentumFlows]);
  const compareSelectedSeries = useMemo(
    () => (compareMemberId ? otherDailySeriesByUserId[compareMemberId] ?? null : null),
    [compareMemberId, otherDailySeriesByUserId],
  );
  const compareSelectedMarkers = useMemo(
    () => (compareMemberId ? otherDailyMarkersByUserId[compareMemberId] ?? null : null),
    [compareMemberId, otherDailyMarkersByUserId],
  );
  const weekRecordedTotal = useMemo(() => meDailySeries.reduce((sum, v) => sum + v, 0), [meDailySeries]);
  const roomWeekTotal = useMemo(() => roomDailySeries.reduce((sum, v) => sum + v, 0), [roomDailySeries]);
  const compareSelectedTotal = useMemo(
    () => (compareSelectedSeries ? compareSelectedSeries.reduce((sum, v) => sum + v, 0) : 0),
    [compareSelectedSeries],
  );
  const compareSelectedEntry = useMemo(
    () => (compareMemberId
      ? leaderboard.entries.find(entry => entry.userId === compareMemberId) ?? null
      : null),
    [compareMemberId, leaderboard.entries],
  );
  const youName = you?.displayName ?? profile?.display_name ?? d.youLabel;

  const trendModeOptions: Array<{ value: DailyTrendMode; label: string }> = useMemo(() => [
    { value: 'room', label: d.dailyDepositModeRoom },
    { value: 'me', label: d.dailyDepositModeMe },
    { value: 'compare', label: d.dailyDepositModeCompare },
  ], [d.dailyDepositModeCompare, d.dailyDepositModeMe, d.dailyDepositModeRoom]);
  const hasOtherMembers = otherMemberIds.length > 0;
  const primaryChartThemeColor = effectiveTrendMode === 'room' ? undefined : you?.themeColor;
  const primaryChartAvatarUrl = effectiveTrendMode === 'room' ? null : (profile?.avatar_url ?? null);
  const primaryChartAvatarFallback = effectiveTrendMode === 'room'
    ? undefined
    : fallbackInitial(profile?.display_name ?? youName);
  const secondaryChartThemeColor = effectiveTrendMode === 'compare' ? compareSelectedEntry?.themeColor : undefined;
  const secondaryChartAvatarUrl = effectiveTrendMode === 'compare' ? (compareSelectedEntry?.avatarUrl ?? null) : null;
  const secondaryChartAvatarFallback = effectiveTrendMode === 'compare'
    ? fallbackInitial(compareSelectedEntry?.displayName ?? d.partnerLabel)
    : undefined;

  const { chartSeries, chartPartnerSeries, chartPrimaryLabel, chartSecondaryLabel, chartDisplayedTotal, chartBarMarkers, chartPartnerBarMarkers } = useMemo(() => {
    if (effectiveTrendMode === 'room') {
      return {
        chartSeries: roomDailySeries,
        chartPartnerSeries: undefined as number[] | undefined,
        chartPrimaryLabel: d.dailyDepositModeRoom,
        chartSecondaryLabel: undefined as string | undefined,
        chartDisplayedTotal: roomWeekTotal,
        chartBarMarkers: roomDailyMarkers,
        chartPartnerBarMarkers: undefined as typeof roomDailyMarkers | undefined,
      };
    } else if (effectiveTrendMode === 'me') {
      return {
        chartSeries: meDailySeries,
        chartPartnerSeries: undefined as number[] | undefined,
        chartPrimaryLabel: d.dailyDepositModeMe,
        chartSecondaryLabel: undefined as string | undefined,
        chartDisplayedTotal: weekRecordedTotal,
        chartBarMarkers: meDailyMarkers,
        chartPartnerBarMarkers: undefined as typeof roomDailyMarkers | undefined,
      };
    } else {
      return {
        chartSeries: meDailySeries,
        chartPartnerSeries: compareSelectedSeries ?? undefined,
        chartPrimaryLabel: d.dailyDepositModeMe,
        chartSecondaryLabel: compareSelectedEntry?.displayName ?? d.partnerLabel,
        chartDisplayedTotal: weekRecordedTotal + compareSelectedTotal,
        chartBarMarkers: meDailyMarkers,
        chartPartnerBarMarkers: compareSelectedMarkers ?? undefined,
      };
    }
  }, [effectiveTrendMode, roomDailySeries, roomWeekTotal, roomDailyMarkers, meDailySeries, weekRecordedTotal, meDailyMarkers, compareSelectedSeries, compareSelectedEntry?.displayName, d.partnerLabel, compareSelectedTotal, compareSelectedMarkers, d.dailyDepositModeRoom, d.dailyDepositModeMe]);
  const selectedPurposeEmptyMessage = purposeScope.kind === 'all' || chartDisplayedTotal > 0
    ? undefined
    : purposeScope.kind === 'bucket'
      ? `No deposits for ${visibleBucketsById.get(purposeScope.bucketId)?.name ?? d.savingsFallback} in ${d.last7Days}.`
      : purposeScope.kind === 'categories'
        ? `No deposits for ${purposeScope.categories.map(category => copy.bucket.categoryLabels[category]).join(', ')} buckets in ${d.last7Days}.`
        : `No deposits for ${copy.bucket.categoryLabels[purposeScope.category]} buckets in ${d.last7Days}.`;
  const weekExpectedTotal = useMemo(
    () => (expectedDailySeries
      ? expectedDailySeries.reduce((sum, v) => sum + v, 0)
      : undefined),
    [expectedDailySeries],
  );
  const expectedCumulativeSeries = useMemo(
    () => (revisions
      ? (() => {
        let running = 0;
        return chartDayKeys.map(key => {
          running += plannedAmountForDate(revisions, key, planPauses);
          return running;
        });
      })()
      : undefined),
    [chartDayKeys, planPauses, revisions],
  );

  const leaderboardEntries: TeamSectionMember[] = useMemo(() => leaderboard.entries.length > 0
    ? leaderboard.entries.map(entry => ({
        userId: entry.userId,
        name: entry.isYou ? youName : (entry.displayName ?? d.partnerLabel),
        fallback: fallbackInitial(entry.displayName ?? (entry.isYou ? profile?.display_name : d.partnerLabel)),
        imageUrl: entry.avatarUrl,
        saved: entry.saved,
        target: entry.target ?? (entry.isYou ? target : 0),
        themeColor: entry.themeColor,
        isYou: entry.isYou,
        streak: entry.streak,
        hasLoggedToday: entry.hasLoggedToday,
      }))
    : (currentUserId ? [{
        userId: currentUserId,
        name: youName,
        fallback: fallbackInitial(profile?.display_name),
        imageUrl: profile?.avatar_url ?? null,
        saved: total,
        target,
        themeColor: you?.themeColor,
        isYou: true,
      }] : []), [leaderboard.entries, youName, d.partnerLabel, profile?.display_name, profile?.avatar_url, you?.themeColor, currentUserId, total, target]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [nudgeBusyMemberId, setNudgeBusyMemberId] = useState<string | null>(null);
  const selectedMemberSnapshot = useMemberSavingSnapshot(activeRoomId, selectedMemberId);

  const selectedMember = useMemo<MemberDetailModalMember | null>(() => {
    if (!selectedMemberId) return null;
    const entry = leaderboard.entries.find(e => e.userId === selectedMemberId);
    if (!entry) return null;
    const isSelf = selectedMemberId === currentUserId;
    const memberBuckets = isSelf
      ? buckets
      : (data.roomMembersBuckets.bucketsByUser[selectedMemberId] ?? []);
    const name = entry.displayName ?? d.partnerLabel;
    const saved = isSelf
      ? memberBuckets.reduce(
          (sum, bucket) => sum + bucketSaved(bucket.id, logs, bucketTransfers, balanceAllocations),
          0,
        )
      : selectedMemberSnapshot.saved;
    return {
      name,
      fallback: fallbackInitial(name),
      avatarUrl: entry.avatarUrl,
      themeColor: entry.themeColor,
      saved,
      target: entry.personalGoalTarget ?? 0,
      buckets: memberBuckets.map(bucket => ({
        id: bucket.id,
        name: bucket.name,
        saved: isSelf
          ? bucketSaved(bucket.id, logs, bucketTransfers, balanceAllocations)
          : (selectedMemberSnapshot.bucketSavedById[bucket.id] ?? 0),
        target: bucket.target_amount,
        category: bucket.category,
      })),
    };
  }, [selectedMemberId, leaderboard.entries, data.roomMembersBuckets.bucketsByUser, d.partnerLabel, currentUserId, buckets, selectedMemberSnapshot.saved, selectedMemberSnapshot.bucketSavedById, logs, bucketTransfers, balanceAllocations]);

  const handleMemberClick = useCallback((entry: TeamSectionMember) => {
    setSelectedMemberId(entry.userId);
  }, []);

  const handleMemberNudge = useCallback(async (entry: TeamSectionMember) => {
    if (entry.isYou) return;
    if (nudgeBusyMemberId === entry.userId) return;

    setNudgeBusyMemberId(entry.userId);
    try {
      const result = await sendNudge({
        partnerUserId: entry.userId,
        roomId: activeRoomId,
        partnerName: entry.name,
      });

      showToast({
        title: result.message,
        tone:
          result.status === 'error' || result.status === 'throttled'
            ? 'warning'
            : result.status === 'sent'
              ? 'success'
              : 'neutral',
        icon: <IconBell size={18} />,
      });

      if (result.ok) {
        haptic('success');
      }
    } finally {
      setNudgeBusyMemberId(current => (current === entry.userId ? null : current));
    }
  }, [activeRoomId, nudgeBusyMemberId, sendNudge, showToast]);

  const handleViewAll = useCallback(() => {
    navigate('/manage-project');
  }, [navigate]);

  const compareMembers = useMemo(() => otherMemberIds.map(id => {
    const entry = leaderboard.entries.find(e => e.userId === id);
    return {
      userId: id,
      displayName: entry?.displayName ?? d.partnerLabel,
      avatarUrl: entry?.avatarUrl ?? null,
      themeColor: entry?.themeColor,
    };
  }), [d.partnerLabel, leaderboard.entries, otherMemberIds]);

  const purposePickerNode = useMemo(() => (purposeCategories.length > 0 ? (
    <MomentumPurposePicker
      categories={purposeCategories}
      buckets={purposePickerBuckets}
      value={purposeScope}
      onChange={setPurposeScope}
      hideBucketRow={effectiveTrendMode !== 'me'}
    />
  ) : undefined), [effectiveTrendMode, purposeCategories, purposePickerBuckets, purposeScope]);

  const modeControlNode = useMemo(() => (hasOtherMembers ? (
    <DailyTrendModeControl
      ariaLabel={d.dailyDepositModeAria}
      options={trendModeOptions}
      value={effectiveTrendMode}
      onChange={setTrendMode}
      disabledValues={purposeScope.kind === 'bucket' ? ['room', 'compare'] : undefined}
    />
  ) : undefined), [d.dailyDepositModeAria, effectiveTrendMode, hasOtherMembers, purposeScope.kind, trendModeOptions]);

  const compareChipsNode = useMemo(() => (hasOtherMembers && effectiveTrendMode === 'compare' ? (
    <CompareMemberDropdown
      ariaLabel={d.dailyDepositCompareAria}
      members={compareMembers}
      selectedId={compareMemberId}
      onSelect={setCompareMemberId}
    />
  ) : undefined), [compareMemberId, compareMembers, d.dailyDepositCompareAria, effectiveTrendMode, hasOtherMembers]);

  return (
    <PullToRefresh onRefresh={refreshAll}>
    <div className="flex flex-col gap-6 px-5 pt-8 pb-6">
      {/* Leaderboard */}
      <TeamSection
        members={leaderboardEntries}
        roomSaved={totalSaved}
        roomTarget={totalTarget}
        emptyBody={d.invitePartnerHint}
        onMemberClick={handleMemberClick}
        onMemberNudge={handleMemberNudge}
        onViewAll={handleViewAll}
      />

      {/* Insights */}
      <div className="flex flex-col gap-3">
        <MomentumChart
          series={chartSeries}
          partnerSeries={chartPartnerSeries}
          labels={chartLabels}
          dateKeys={chartDayKeys}
          barMarkers={chartBarMarkers}
          partnerBarMarkers={chartPartnerBarMarkers}
          yourName={profile?.display_name ?? d.youLabel}
          partnerName={chartSecondaryLabel}
          primaryLabel={chartPrimaryLabel}
          primaryThemeColor={primaryChartThemeColor}
          primaryAvatarUrl={primaryChartAvatarUrl}
          primaryAvatarFallback={primaryChartAvatarFallback}
          secondaryLabel={chartSecondaryLabel}
          secondaryThemeColor={secondaryChartThemeColor}
          secondaryAvatarUrl={secondaryChartAvatarUrl}
          secondaryAvatarFallback={secondaryChartAvatarFallback}
          displayedTotal={chartDisplayedTotal}
          emptyStateMessage={selectedPurposeEmptyMessage}
          purposePicker={purposePickerNode}
          modeControl={modeControlNode}
          compareChips={compareChipsNode}
          expectedSeries={expectedDailySeries}
          todayIndex={6}
          weekTotal={weekRecordedTotal}
          weekExpected={weekExpectedTotal}
        />
        {SHOW_DEPOSIT_RACE && firstOtherMemberByJoinedAt && (
          <SavingRaceSection
            logs={logs}
            buckets={[...buckets, ...data.roomMembersBuckets.allBuckets]}
            yourUserId={currentUserId}
            partnerUserId={firstOtherMemberByJoinedAt}
            yourName={profile?.display_name ?? d.youLabel}
            partnerName={firstOtherEntry?.displayName ?? d.partnerLabel}
            activeRoomId={activeRoomId}
            expectedSeries={expectedCumulativeSeries}
          />
        )}
      </div>

      {/* Activity */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-mono text-lg font-bold leading-tight text-ink">{d.activity}</h2>
          {logs.length > 0 && (
            <Button variant="link" size="sm" onClick={() => setHistoryOpen(true)}>
              {d.viewAll}
            </Button>
          )}
        </div>
        {mergedActivity.length > 0 ? (
          <div className="rounded-xl bg-surface shadow-soft px-4 divide-y divide-well">
            {mergedActivity.map(item => {
              if (item.kind === 'deposit') {
                return (
                  <ActivityTimelineRow
                    key={`d-${item.id}`}
                    actorName={item.actorName}
                    actorFallback={item.actorFallback}
                    bucketName={item.bucketName}
                    amount={item.amount}
                    occurredAt={item.occurredAt}
                    hasSlip={item.hasSlip}
                  />
                );
              }
              if (item.kind === 'balance') {
                return <BalanceActivityRow key={`b-${item.id}`} entry={item.entry} />;
              }
              return <BucketEventActivityRow key={`e-${item.id}`} item={item.item} />;
            })}
          </div>
        ) : (
          <div className="rounded-xl bg-surface p-5 shadow-soft">
            <h3 className="font-mono text-sm font-bold text-ink">{d.noActivityYet}</h3>
            <p className="mt-1 font-mono text-xs text-ink-muted">{d.noActivityBody(formatMoney(100))}</p>
          </div>
        )}
        <ActivityHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          items={activityItems}
          bucketEvents={bucketEventItems}
        />
      </section>

      <MemberDetailModal
        open={selectedMemberId !== null}
        member={selectedMember}
        onClose={() => setSelectedMemberId(null)}
      />
    </div>
    </PullToRefresh>
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

interface BucketEventActivityItem {
  event: BucketActivityEvent;
  actorName: string;
  actorFallback: string;
  actorAvatarUrl?: string | null;
}

type MergedActivity =
  | { kind: 'deposit'; id: string; at: string; actorName: string; actorFallback: string; bucketName: string; amount: number; occurredAt: string; hasSlip: boolean }
  | { kind: 'balance'; id: string; at: string; entry: BalanceActivityEntry }
  | { kind: 'bucket_event'; id: string; at: string; item: BucketEventActivityItem };

function buildMergedActivity(
  deposits: DepositActivityItem[],
  balances: BalanceActivityEntry[],
  bucketEvents: BucketEventActivityItem[],
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
  const events: MergedActivity[] = bucketEvents.map(item => ({
    kind: 'bucket_event',
    id: item.event.id,
    at: item.event.created_at,
    item,
  }));
  void currentUserId; // currentUserId is captured in row UI, not the merge
  return [...dep, ...bal, ...events]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, Math.max(1, limit));
}

/**
 * Bucket transfer / remove row for the merged activity feed. Payload
 * fields come from `activity_events`, which the RPCs in 0059 write
 * server-side; the transfer-note text is intentionally NOT included
 * because the server only carries `has_note` for partner visibility.
 */
function BucketEventActivityRow({ item }: { item: BucketEventActivityItem }) {
  const { copy, formatMoney, formatRelativeTime } = useI18n();
  const d = copy.dashboard;
  const event = item.event;
  const payload = event.payload as Record<string, unknown>;

  const pickString = (key: string): string | null => {
    const value = payload[key];
    return typeof value === 'string' && value.trim() ? value : null;
  };

  const isTransfer = event.event_key === 'bucket_transfer_created';
  const sourceName = pickString('source_bucket_name');
  const destinationName = pickString('destination_bucket_name');
  const bucketName = pickString('bucket_name') ?? sourceName;

  const description = isTransfer
    ? (sourceName && destinationName
        ? d.transferredBetweenBuckets(sourceName, destinationName)
        : d.transferredBetweenBucketsFallback)
    : (bucketName ? d.removedBucket(bucketName) : d.removedBucketFallback);

  const amountText = isTransfer && event.amount != null
    ? formatMoney(event.amount)
    : null;

  return (
    <div className="flex items-start gap-3 py-3">
      <IconBubble tone="muted" size="md">
        {isTransfer ? <IconArrowRight size={18} /> : <IconTrash size={18} />}
      </IconBubble>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-sm font-bold text-ink truncate">{item.actorName}</span>
          <span className="font-mono text-xs text-ink-muted shrink-0">{formatRelativeTime(event.created_at)}</span>
        </div>
        <p className="mt-0.5 font-mono text-xs text-ink-muted truncate">{description}</p>
      </div>
      {amountText && (
        <div className="shrink-0 font-mono text-sm font-bold text-ink-muted">
          {amountText}
        </div>
      )}
    </div>
  );
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
            : d.checkedBalanceDiff(formatDirectionalAdjustment(entry.difference_amount, copy.reconcile.statAdjustedUp, copy.reconcile.statAdjustedDown))}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">
          {entry.reason ? `${copy.reconcile.reasons[entry.reason].label} · ` : ''}{formatRelativeTime(entry.checked_at)}
        </p>
      </div>
    </div>
  );
}

interface DailyTrendModeControlProps {
  ariaLabel: string;
  options: Array<{ value: DailyTrendMode; label: string }>;
  value: DailyTrendMode;
  onChange: (next: DailyTrendMode) => void;
  disabledValues?: DailyTrendMode[];
}

/** Custom `Room | Me | Compare` segmented control for the Daily Deposit
 *  Trend card. Pill-style tabs match the Smart Buckets member picker
 *  language so the page stays visually coherent on mobile. */
const TREND_MODE_HINT_STORAGE_KEY = 'daily-trend-mode-hint-seen-v1';

function DailyTrendModeControl({ ariaLabel, options, value, onChange, disabledValues }: DailyTrendModeControlProps) {
  const reduceMotion = useReducedMotion();
  const ambientMotionReady = useAmbientMotionReady();
  const [showHint, setShowHint] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (reduceMotion || !ambientMotionReady) return;
    try {
      if (window.localStorage.getItem(TREND_MODE_HINT_STORAGE_KEY)) return;
    } catch {
      return;
    }
    const el = trackRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let startId = 0;
    let endId = 0;
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      startId = window.setTimeout(() => setShowHint(true), 350);
      endId = window.setTimeout(() => {
        setShowHint(false);
        try { window.localStorage.setItem(TREND_MODE_HINT_STORAGE_KEY, '1'); } catch { /* ignore */ }
      }, 6400);
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(startId);
      window.clearTimeout(endId);
    };
  }, [ambientMotionReady, reduceMotion]);

  return (
    <LayoutGroup id="trend-mode-pill">
      <div
        ref={trackRef}
        role="tablist"
        aria-label={ariaLabel}
        className="relative inline-flex h-10 w-fit items-center gap-1 self-start overflow-hidden rounded-pill bg-well p-1 shadow-[inset_2px_2px_5px_rgba(120,89,61,0.16),inset_-2px_-2px_5px_rgba(255,255,255,0.62)]"
      >
        {showHint && ambientMotionReady && (
          <motion.span
            aria-hidden
            initial={{ x: '-110%', opacity: 0 }}
            animate={{ x: '220%', opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 2,
              ease: [0.22, 1, 0.36, 1],
              times: [0, 0.15, 0.85, 1],
              repeat: 2,
              repeatDelay: 0.2,
            }}
            className="pointer-events-none absolute inset-y-0 left-0 z-20 w-1/2 rounded-pill mix-blend-screen"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(242,107,26,0.45) 45%, rgba(255,200,140,0.85) 50%, rgba(242,107,26,0.45) 55%, transparent 100%)',
              filter: 'blur(2px)',
            }}
          />
        )}
        {options.map(option => {
          const active = option.value === value;
          const disabled = disabledValues?.includes(option.value) ?? false;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={
                'relative inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-pill px-2.5 font-mono text-[11px] font-bold transition-colors '
                + (disabled ? 'text-ink-dim opacity-40 cursor-not-allowed' : active ? 'text-ink-inverse' : 'text-ink-muted')
              }
            >
              {active && (
                <motion.span
                  layoutId="trend-mode-active-pill"
                  className="absolute inset-0 rounded-pill bg-brand-500 shadow-[0_4px_12px_rgba(242,107,26,0.28)]"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative z-10">{option.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

interface CompareMember {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  themeColor?: ProfileTheme;
}

interface CompareMemberDropdownProps {
  ariaLabel: string;
  members: CompareMember[];
  selectedId: string | null;
  onSelect: (next: string) => void;
}

/** Compact dropdown for choosing the Compare-mode member inside the Daily
 *  Deposit Trend card. The menu expands in-place so the chart card can
 *  grow/shrink smoothly without an overlay clipping the rounded shell. */
function CompareMemberDropdown({ ariaLabel, members, selectedId, onSelect }: CompareMemberDropdownProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const selected = members.find(member => member.userId === selectedId) ?? members[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-compare-member-dropdown]')) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!selected) return null;

  return (
    <motion.div
      data-compare-member-dropdown
      className="relative z-30 w-[7.75rem] max-w-[34vw] min-w-[7rem]"
    >
      <div className="h-10 rounded-pill bg-well p-1 shadow-[inset_2px_2px_5px_rgba(120,89,61,0.16),inset_-2px_-2px_5px_rgba(255,255,255,0.62)]">
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setOpen(prev => !prev);
            haptic('success');
          }}
          className="relative flex h-8 w-full min-w-0 items-center gap-1.5 rounded-pill bg-surface px-1 pr-1.5 font-mono text-[11px] font-bold text-ink shadow-[0_1px_3px_rgba(58,42,31,0.08)] transition-transform active:scale-[0.98]"
        >
          <span className="inline-flex shrink-0 [&_.rounded-full]:!h-5 [&_.rounded-full]:!w-5">
            <Avatar
              size="sm"
              imageUrl={selected.avatarUrl ?? undefined}
              fallback={fallbackInitial(selected.displayName)}
              themeColor={selected.themeColor}
            />
          </span>
          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">
            {selected.displayName}
          </span>
          <motion.span
            aria-hidden
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34 }}
            className="shrink-0 text-ink-muted"
          >
            <IconChevronDown size={14} />
          </motion.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="compare-member-options"
            initial={reduceMotion ? { opacity: 1, scaleY: 1, y: 0 } : { opacity: 0, scaleY: 0.86, y: -4 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1, scaleY: 1, y: 0 } : { opacity: 0, scaleY: 0.9, y: -3 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.34, ease: [0.16, 1, 0.2, 1] }}
            className="absolute left-0 top-full mt-1 w-full origin-top overflow-hidden"
          >
            <motion.div
              role="listbox"
              aria-label={ariaLabel}
              className="mt-1 flex max-h-44 flex-col gap-1 overflow-y-auto rounded-[1rem] bg-well p-1 shadow-[inset_1px_1px_3px_rgba(120,89,61,0.12),inset_-1px_-1px_3px_rgba(255,255,255,0.5)]"
              initial="closed"
              animate="open"
              exit="closed"
              variants={reduceMotion
                ? {
                    open: {},
                    closed: {},
                  }
                : {
                    open: { transition: { staggerChildren: 0.035, delayChildren: 0.03 } },
                    closed: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
                  }}
            >
              {members.map(member => {
                const active = member.userId === selectedId;
                return (
                  <motion.button
                    key={member.userId}
                    type="button"
                    role="option"
                    aria-selected={active}
                    title={member.displayName}
                    onClick={() => {
                      onSelect(member.userId);
                      setOpen(false);
                      haptic('success');
                    }}
                    variants={{
                      open: { opacity: 1, x: 0 },
                      closed: reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 },
                    }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
                    className={
                      'relative flex h-9 w-full min-w-0 items-center gap-1.5 rounded-xl px-1.5 pr-2 font-mono text-[11px] font-bold transition-colors '
                      + (active ? 'text-ink-inverse' : 'text-ink-muted hover:bg-surface/70')
                    }
                  >
                    {active && (
                      <motion.span
                        layoutId="compare-member-dropdown-active"
                        className="absolute inset-0 rounded-xl bg-brand-500"
                        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                    <span className="relative z-10 inline-flex shrink-0 [&_.rounded-full]:!h-5 [&_.rounded-full]:!w-5">
                      <Avatar
                        size="sm"
                        imageUrl={member.avatarUrl ?? undefined}
                        fallback={fallbackInitial(member.displayName)}
                        themeColor={member.themeColor}
                      />
                    </span>
                    <span className="relative z-10 min-w-0 flex-1 truncate whitespace-nowrap text-left">
                      {member.displayName}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

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
 * filter selection persists per room in localStorage. Expected Progress
 * overlay is only meaningful in "All buckets" scope.
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
