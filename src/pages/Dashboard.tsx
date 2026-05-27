import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ActivityHistoryModal } from '../components/ActivityHistoryModal/ActivityHistoryModal';
import { ActivityTimelineRow } from '../components/ActivityTimelineRow/ActivityTimelineRow';
import { Avatar } from '../components/Avatar/Avatar';
import { BalanceCheckStatus } from '../components/BalanceCheckStatus/BalanceCheckStatus';
import { SavingPlanCard } from '../components/SavingPlanCard/SavingPlanCard';
import { MigrationWizard } from '../components/MigrationWizard/MigrationWizard';
import { BucketRow } from '../components/BucketRow/BucketRow';
import { BucketGrid } from '../components/BucketGrid/BucketGrid';
import { BucketManager } from '../components/BucketManager/BucketManager';
import { BucketSheet } from '../components/BucketSheet/BucketSheet';
import { BucketDragCard } from '../components/BucketDragCard/BucketDragCard';
import { BucketDragHint } from '../components/BucketDragHint/BucketDragHint';
import { BucketTransferSheet } from '../components/BucketTransferSheet/BucketTransferSheet';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
  type Modifiers,
} from '@dnd-kit/core';
import { Button } from '../components/Button/Button';
import { CreateBucketForm } from '../components/CreateBucketForm/CreateBucketForm';
import { RoomLeaderboardList, type PlayerProgressEntry } from '../components/RoomLeaderboardList/RoomLeaderboardList';
import { IconBubble } from '../components/IconBubble/IconBubble';
import { MicroGoalCard } from '../components/MicroGoalCard/MicroGoalCard';
import { MomentumChart } from '../components/MomentumChart/MomentumChart';
import { HeroCard } from '../components/HeroCard/HeroCard';
import { VaultUpdatePreviewModal } from '../components/VaultUpdatePreviewModal/VaultUpdatePreviewModal';
import { VerifiedBalanceReminderModal } from '../components/VerifiedBalanceReminderModal/VerifiedBalanceReminderModal';
import { NudgeButton } from '../components/NudgeButton/NudgeButton';
import { BellIconButton } from '../components/Notifications/BellIconButton';
import { useUnreadNotificationsCount } from '../hooks/useUnreadNotificationsCount';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import {
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconRocket,
  IconTrash,
  IconUser,
  IconVault,
} from '../components/Icon/Icon';
import { BucketCategoryIcon } from '../components/BucketCategoryIcon/BucketCategoryIcon';
import { MomentumPurposePicker } from '../components/MomentumPurposePicker/MomentumPurposePicker';
import { PullToRefresh } from '../components/PullToRefresh/PullToRefresh';
import { ScrollFadeContainer } from '../components/ScrollFadeContainer/ScrollFadeContainer';
import { BucketNextPickerModal } from '../components/BucketNextPickerModal/BucketNextPickerModal';
import { BUCKET_CATEGORY_ORDER } from '../lib/bucketCategories';
import { computeBucketIntent } from '../lib/bucketIntent';
import { calcDailySummary } from '../lib/bucketDailySummary';
import { calcPeriodAwareStreak } from '../lib/streakCalculation';
import { Modal } from '../components/Modal/Modal';
import { OutcomeModal } from '../components/OutcomeModal/OutcomeModal';
import { SavingRaceChart } from '../components/SavingRaceChart/SavingRaceChart';
import { SavingRaceFilter } from '../components/SavingRaceFilter/SavingRaceFilter';
import { useAuth } from '../hooks/useAuth';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useSharedData } from '../hooks/useSharedData';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { useMigrationState } from '../hooks/useMigrationState';
import { useLogs } from '../hooks/useLogs';
import { useBucketIntentSettings } from '../hooks/useBucketIntentSettings';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import { useSavingsTotal } from '../hooks/useSavingsTotal';
import { useSmartDefaultAmount } from '../hooks/useSmartDefaultAmount';
import { useI18n } from '../i18n/useI18n';
import { bucketSaved, hasDuplicateBucketName, shouldAutofillBucketName, sumTargets } from '../lib/buckets';
import { calcBucketPace } from '../lib/paceCalculation';
import { cumulativeRaceSeries } from '../lib/comparisonStats';
import { cumulativeAmountSeries, fallbackInitial, lastSevenDateKeys, lastSevenDayLabels } from '../lib/dashboardStats';
import { formatCurrency } from '../lib/format';
import { availablePurposeCategoriesForMode, purposeDailyMarkers, purposeFilteredDailySeries, type MomentumPurposeScope } from '../lib/momentumPurpose';
import { haptic } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { daysSince, formatDirectionalAdjustment } from '../lib/reconcile';
import {
  activeRevisionAt,
  daysBetween,
  habitStatusFromDeposits,
  isPausedOnDate,
  moneyStatusFor,
  nextUpcomingRevision,
  plannedAmountForDate,
  todayBangkokKey,
} from '../lib/savingPlan';
import type { SavingPlanRevision } from '../types';
import type { BalanceActivityEntry, Bucket, BucketCategory, BucketCreateRuleData, BucketTransfer, ProfileTheme, SavingRuleType } from '../types';
import type { BucketActivityEvent } from '../hooks/useBucketActivityEvents';

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

type DailyTrendMode = 'room' | 'me' | 'compare';

const restrictBucketDragToViewport: Modifier = ({ activeNodeRect, transform, windowRect }) => {
  if (!activeNodeRect || !windowRect) return transform;

  const minX = windowRect.left - activeNodeRect.left;
  const maxX = windowRect.right - activeNodeRect.right;
  const minY = windowRect.top - activeNodeRect.top;
  const maxY = windowRect.bottom - activeNodeRect.bottom;

  return {
    ...transform,
    x: Math.min(Math.max(transform.x, minX), maxX),
    y: Math.min(Math.max(transform.y, minY), maxY),
  };
};

const bucketDragModifiers: Modifiers = [restrictBucketDragToViewport];
const DEFAULT_BUCKET_CATEGORY = 'flight' as const;

function bucketDragHintDistance(delta: number) {
  if (delta === 0) return '0px';

  const abs = Math.abs(delta);
  const distance = `calc(${abs * 100}% + ${abs}rem)`;
  return delta > 0 ? distance : `calc(-${abs * 100}% - ${abs}rem)`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const migration = useMigrationState(user?.id);
  const { activeRoom, activeRoomId } = useRoom();
  const data = useSharedData();
  const { refreshAll, isRefreshing } = data;
  const {
    quickAmounts,
    profile: dataProfile,
    loading: profileLoading,
    markBucketDragHintSeen,
  } = data.profile;
  const {
    personalGoalTarget,
    roomGoalTarget,
    loading: goalLoading,
    error: goalError,
  } = data.goal;
  useRooms();
  const { settings: intentSettings, setManualNextBucket, logIntentEvent } = useBucketIntentSettings(activeRoomId);
  const { buckets, loading: bucketsLoading, saveBuckets, reviewBucketCategories, refetch: refetchBuckets } = data.buckets;
  const { transfers: bucketTransfers, upsertTransfer } = data.bucketTransfers;
  const { events: bucketActivityEvents } = data.bucketActivityEvents;
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
  // Daily Deposit Trend mode (Task 38.1). Default is `room` so 3-7
  // member rooms read as a room total instead of "You vs Others (N)";
  // 2-user rooms still show a clear room/me/compare experience.
  const [trendMode, setTrendMode] = useState<DailyTrendMode>('room');
  const [purposeScope, setPurposeScope] = useState<MomentumPurposeScope>({ kind: 'all' });
  const allVisibleBuckets = useMemo(
    () => [...buckets, ...data.roomMembersBuckets.allBuckets],
    [buckets, data.roomMembersBuckets.allBuckets],
  );
  const visibleBucketsById = useMemo(() => new Map<string, Bucket>(
    allVisibleBuckets.map(b => [b.id, b]),
  ), [allVisibleBuckets]);
  // Selected compare member for Compare mode. Always represents one
  // other member — Compare must never render more than current user +
  // one selected member.
  const [compareMemberId, setCompareMemberId] = useState<string | null>(null);
  const effectiveTrendMode: DailyTrendMode = purposeScope.kind === 'bucket' ? 'me' : trendMode;
  const purposeCategories = useMemo(
    () => availablePurposeCategoriesForMode(
      effectiveTrendMode,
      buckets,
      allVisibleBuckets,
      logs,
      visibleBucketsById,
      compareMemberId,
      user?.id,
    ),
    [effectiveTrendMode, buckets, allVisibleBuckets, logs, visibleBucketsById, compareMemberId, user?.id],
  );
  const purposePickerBuckets = effectiveTrendMode === 'me' ? buckets : allVisibleBuckets;
  const [expandedBucketId, setExpandedBucketId] = useState<string | null>(null);
  const smartDefault = useSmartDefaultAmount(user?.id, expandedBucketId, logs);
  const [bucketModalOpen, setBucketModalOpen] = useState(false);
  const [completedBucketsOpen, setCompletedBucketsOpen] = useState(false);
  const [manageBucketsOpen, setManageBucketsOpen] = useState(false);
  const [migrationBannerDismissed, setMigrationBannerDismissed] = useState(false);
  const [manageBucketTransferSheetOpen, setManageBucketTransferSheetOpen] = useState(false);
  const [nextPickerOpen, setNextPickerOpen] = useState(false);
  const [transferIntent, setTransferIntent] = useState<{
    sourceId: string;
    destinationId: string | null;
    initialAmount?: number | null;
    suggestionReason?: string | null;
  } | null>(null);
  // Local "dismissed this render" flag so the hint disappears
  // immediately once it auto-times-out, the user closes it, or a drag
  // starts. Account-level persistence owns the "never show again"
  // behavior across devices.
  const [bucketDragHintDismissed, setBucketDragHintDismissed] = useState(false);
  const [bucketDragHintMarkedThisSession, setBucketDragHintMarkedThisSession] = useState(false);

  // dnd-kit sensors for the bucket transfer drag shortcut (slice 40.6).
  // Activation thresholds follow plan §12: desktop ~150ms / touch ~250ms so
  // a quick tap still opens the deposit BucketSheet and a press-and-drag
  // triggers transfer mode.
  const dragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleBucketDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const sourceId = String(active.id);
    const destinationId = String(over.id);
    if (sourceId === destinationId) return;

    const sourceBucket = bucketItems.find(b => b.id === sourceId);
    const destBucket = bucketItems.find(b => b.id === destinationId);
    const sourceIsDone = sourceBucket?.status?.kind === 'done';
    const extraAmt = sourceIsDone && sourceBucket
      ? Math.max(0, sourceBucket.saved - sourceBucket.target)
      : 0;

    let initialAmount: number | null = null;
    let suggestionReason: string | null = null;
    if (sourceIsDone && extraAmt > 0) {
      initialAmount = extraAmt;
      if (destBucket && destBucket.id === nextBucketId) {
        suggestionReason = copy.bucketTransfer.suggestion.completedToNext(
          sourceBucket!.name, destBucket.name,
        );
      } else {
        suggestionReason = copy.bucketTransfer.suggestion.completedExtra(sourceBucket!.name);
      }
    }

    setTransferIntent({ sourceId, destinationId, initialAmount, suggestionReason });
  }

  const markBucketDragHintSeenForAccount = useCallback(() => {
    setBucketDragHintMarkedThisSession(true);
    void markBucketDragHintSeen();
  }, [markBucketDragHintSeen]);

  // Once the user actually starts a drag the hint has served its
  // purpose — dismiss it locally and persist `seen_at` so it never
  // reopens on this account (plan §13).
  const dismissBucketDragHint = useCallback(() => {
    setBucketDragHintDismissed(true);
    markBucketDragHintSeenForAccount();
  }, [markBucketDragHintSeenForAccount]);

  function handleBucketDragStart() {
    if (bucketDragHintDismissed) return;
    dismissBucketDragHint();
  }

  const handleBucketDragHintShown = useCallback(() => {
    markBucketDragHintSeenForAccount();
  }, [markBucketDragHintSeenForAccount]);

  const handleBucketDragHintDismiss = useCallback(() => {
    dismissBucketDragHint();
  }, [dismissBucketDragHint]);
  const [bucketGoalOutcome, setBucketGoalOutcome] = useState<{ name: string; target: number } | null>(null);
  const [vaultPreview, setVaultPreview] = useState<{
    prevSaved: number;
    newSaved: number;
    target: number;
    depositAmount: number;
    bucketName: string;
    reachedBucket: boolean;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [vbReminder, setVbReminder] = useState<{ open: boolean; days: number | null }>({ open: false, days: null });
  const vbReminderEvaluatedRef = useRef(false);
  const [bucketCategory, setBucketCategory] = useState<BucketCategory | null>(DEFAULT_BUCKET_CATEGORY);
  const [bucketName, setBucketName] = useState(() => copy.bucket.defaultNames[DEFAULT_BUCKET_CATEGORY]);
  const [bucketTarget, setBucketTarget] = useState('30000');
  const [message, setMessage] = useState<string | null>(null);
  const bucketOptions = BUCKET_CATEGORY_ORDER.map((id) => ({
    id,
    icon: <BucketCategoryIcon category={id} size={22} />,
    label: copy.bucket.categoryLabels[id],
  }));
  const loading = goalLoading || bucketsLoading || logsLoading || leaderboard.loading;
  const { shouldShowLoader: shouldShowSkeleton } = useLoadingGate({
    loading,
    showAfterMs: 120,
    minimumVisibleMs: 400,
  });
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

  // Daily Deposit Trend safety: keep `compareMemberId` aligned with the
  // current `otherMemberIds`. When the selected compare member leaves
  // the room (or none exists yet), pick the first available member.
  // When no other members exist, fall back out of Compare mode.
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
  const selectedBucket = bestMicroGoalBucket(buckets, logs, bucketTransfers, d, formatMoney);
  const intentResult = computeBucketIntent({
    buckets,
    logs,
    transfers: bucketTransfers,
    currentUserId: user?.id,
    settings: intentSettings,
  });
  const { doneBucketIds, focusBucketId, nextBucketId, focusStates } = intentResult;
  /* eslint-disable react-hooks/preserve-manual-memoization */
  const bucketItems = useMemo(() => {
    const statusLabels = copy.bucketIntent.status;
    return buckets.map(bucket => {
      const saved = bucketSaved(bucket.id, logs, bucketTransfers);
      const focusState = focusStates.get(bucket.id);
      let status: { kind: 'focus' | 'next' | 'done' | 'queued' | 'overdue'; label: string } | undefined;
      if (focusState) {
        const label = statusLabels[focusState] ?? '';
        status = { kind: focusState, label };
      }
      const paceResult = bucket.deadline
        ? calcBucketPace(bucket, logs, undefined, bucketTransfers)
        : null;
      return {
        id: bucket.id,
        icon: bucketIcon(bucket.category),
        name: bucket.name,
        saved,
        target: bucket.target_amount,
        category: bucket.category,
        deadline: bucket.deadline,
        status,
        pace: paceResult ? { status: paceResult.status, remainingDays: paceResult.remainingDays } : null,
      };
    }).sort((a, b) => {
      const kindOrder: Record<string, number> = { overdue: 0, focus: 1, next: 2, queued: 3, done: 4 };
      const orderA = kindOrder[a.status?.kind ?? 'queued'] ?? 3;
      const orderB = kindOrder[b.status?.kind ?? 'queued'] ?? 3;
      if (orderA !== orderB) return orderA - orderB;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      const pctA = a.target > 0 ? a.saved / a.target : 0;
      const pctB = b.target > 0 ? b.saved / b.target : 0;
      return pctB - pctA;
    });
  }, [buckets, logs, bucketTransfers, focusStates, copy.bucketIntent.status]);
  const activeBucketItems = useMemo(() => bucketItems.filter(b => b.status?.kind !== 'done'), [bucketItems]);
  const completedBucketItems = useMemo(() => bucketItems.filter(b => b.status?.kind === 'done'), [bucketItems]);
  /* eslint-enable react-hooks/preserve-manual-memoization */
  // One-time bucket drag hint (Sprint 40.9). The hint is purely
  // teaching the drag shortcut, so it only makes sense when:
  //   * the user is on their own active buckets (caller already
  //     ensures this branch — partner buckets render a different grid),
  //   * the user has at least two own active buckets to drag between,
  //   * the account hasn't already seen the hint, and
  //   * the user hasn't already dismissed it this session.
  // Profile loading is treated as "not yet eligible" so we don't flash
  // the hint to a returning user whose profile row is still resolving.
  const bucketDragHintSeenOnAccount = Boolean(dataProfile?.bucket_drag_hint_seen_at);
  const showBucketDragHint =
    activeBucketItems.length >= 2
    && !profileLoading
    && !bucketDragHintDismissed
    && (!bucketDragHintSeenOnAccount || bucketDragHintMarkedThisSession);
  const bucketDragHintDemo = (() => {
    if (!showBucketDragHint) return null;

    const sourceIndex = 0;
    const destinationIndex = 1;
    const source = activeBucketItems[sourceIndex];
    const destination = activeBucketItems[destinationIndex];
    if (!source || !destination) return null;

    const sourceCol = sourceIndex % 2;
    const sourceRow = Math.floor(sourceIndex / 2);
    const destinationCol = destinationIndex % 2;
    const destinationRow = Math.floor(destinationIndex / 2);

    return {
      sourceId: source.id,
      destinationId: destination.id,
      offset: {
        x: bucketDragHintDistance(destinationCol - sourceCol),
        y: bucketDragHintDistance(destinationRow - sourceRow),
      },
    };
  })();

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
      status?: { kind: 'focus' | 'next' | 'done' | 'queued' | 'overdue'; label: string };
    }[];
  }
  const otherMemberBucketGroups: OtherMemberBucketGroup[] = otherMemberIds
    .map(userId => {
      const memberBuckets = roomMembersBucketsByUser[userId] ?? [];
      const entry = leaderboard.entries.find(e => e.userId === userId);
      const name = entry?.displayName ?? d.partnerLabel;
      const items = memberBuckets.map(bucket => {
        const saved = bucketSaved(bucket.id, logs);
        const isDone = bucket.target_amount > 0 && saved >= bucket.target_amount;
        return {
          id: bucket.id,
          icon: bucketIcon(bucket.category),
          name: bucket.name,
          saved,
          target: bucket.target_amount,
          status: isDone ? { kind: 'done' as const, label: copy.bucketIntent.status.done } : undefined,
        };
      });
      return { userId, name, items };
    })
    .filter(group => group.items.length > 0);
  const activeOtherGroup = bucketView === 'mine'
    ? null
    : otherMemberBucketGroups.find(group => group.userId === bucketView) ?? null;
  const activityItems = useMemo(() => logs.map(log => ({
    id: log.id,
    actorName: log.display_name ?? (log.user_id === user?.id ? profile?.display_name ?? d.youLabel : d.partnerLabel),
    actorFallback: fallbackInitial(log.display_name),
    bucketName: log.bucket_name ?? d.savingsFallback,
    amount: log.amount,
    occurredAt: log.created_at,
    hasSlip: Boolean(log.slip_url),
    slipUrl: log.slip_url,
  })), [logs, user?.id, profile?.display_name, d.youLabel, d.partnerLabel, d.savingsFallback]);
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
  const hasBucketRules = buckets.some(bucket => Boolean(bucket.deadline && bucket.saving_rule_type));
  const bucketSummaryItems = useMemo(
    () => calcDailySummary(buckets, logs, todayKey, bucketTransfers),
    [buckets, logs, todayKey, bucketTransfers],
  );
  const bucketStreak = useMemo(
    () => calcPeriodAwareStreak(buckets, logs, todayKey, streakFrozenDates, bucketTransfers),
    [buckets, logs, todayKey, streakFrozenDates, bucketTransfers],
  );
  const migrationBuckets = useMemo(
    () => buckets.filter(bucket => !bucket.deadline || migration.state.completedBucketIds.includes(bucket.id)),
    [buckets, migration.state.completedBucketIds],
  );
  const migrationNeedsSetup = migration.loaded
    && !migration.state.done
    && (buckets.some(bucket => !bucket.deadline) || migration.state.completedBucketIds.length > 0);
  const migrationWizardOpen = migrationNeedsSetup && !migration.state.dismissed;
  const showMigrationBanner = migrationNeedsSetup
    && migration.state.dismissed
    && !migrationBannerDismissed;
  const displayedHabitStatus = hasBucketRules
    ? {
        state: bucketStreak.trackable
          ? bucketStreak.hasMetCurrentPeriod
            ? 'active' as const
            : 'at_risk' as const
          : 'no_deposits_yet' as const,
        lastDepositDateKey: bucketStreak.lastDepositDateKey,
        daysSinceLastDeposit: bucketStreak.lastDepositDateKey
          ? Math.max(0, daysBetween(bucketStreak.lastDepositDateKey, todayKey))
          : null,
        hasDepositedToday: bucketStreak.hasLoggedToday,
        streak: bucketStreak.streak,
        streakUnit: bucketStreak.unit,
      }
    : habitStatus;
  const heroStreak = displayedHabitStatus.streak ?? 0;
  const heroStreakUnit = hasBucketRules
    ? bucketStreak.unit
    : ('streakUnit' in displayedHabitStatus ? displayedHabitStatus.streakUnit : undefined);

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
  const handleVbSubmitCb = useCallback(async (actualAmount: number, reason?: Parameters<typeof createCheckpoint>[0]['reason']) => {
    const result = await createCheckpoint({ actualAmount, reason });
    if (!result.error) haptic(result.differenceAmount === 0 ? 'success' : 'milestone');
    return result;
  }, [createCheckpoint]);
  const verifiedBalanceSlot = useMemo(() => reconciledAppBalance !== null
    ? {
        amount: reconciledAppBalance,
        sinceLabel: verifiedSinceLabel,
        matched: latestCheckpoint ? latestCheckpoint.difference_amount === 0 : false,
        diff: latestCheckpoint?.difference_amount ?? 0,
        onSubmit: handleVbSubmitCb,
      }
    : null, [reconciledAppBalance, verifiedSinceLabel, latestCheckpoint, handleVbSubmitCb]);

  // Merged activity feed: top 3 most-recent items across deposits,
  // balance checks, and bucket transfer / remove events from
  // `activity_events`. Each item keeps its native kind so the row UI
  // can match (deposit timeline row vs sanitized balance-check row vs
  // bucket-event row). Actor names resolve through the leaderboard so
  // "You" labelling stays consistent with the rest of the dashboard.
  const bucketEventItems = useMemo(() => {
    const resolveActor = (actorUserId: string | null) => {
      if (!actorUserId) return { name: d.partnerLabel, fallback: fallbackInitial(undefined), avatar: null as string | null | undefined };
      if (actorUserId === user?.id) return { name: profile?.display_name ?? d.youLabel, fallback: fallbackInitial(profile?.display_name), avatar: profile?.avatar_url };
      const entry = leaderboard.entries.find(e => e.userId === actorUserId);
      return { name: entry?.displayName ?? d.partnerLabel, fallback: fallbackInitial(entry?.displayName), avatar: entry?.avatarUrl };
    };
    return bucketActivityEvents.map(event => {
      const actor = resolveActor(event.actor_user_id);
      return { event, actorName: actor.name, actorFallback: actor.fallback, actorAvatarUrl: actor.avatar };
    });
  }, [bucketActivityEvents, leaderboard.entries, user?.id, profile?.display_name, profile?.avatar_url, d.youLabel, d.partnerLabel]);
  const mergedActivity = useMemo(() => buildMergedActivity(
    activityItems,
    balanceActivity,
    bucketEventItems,
    3,
    user?.id,
  ), [activityItems, balanceActivity, bucketEventItems, user?.id]);

  // Saving Plan chart overlays: per-day Expected Progress aligned to
  // the same 7-day window the deposit charts use. We deliberately do
  // not include Verified Balance here — these series are Recorded vs
  // Expected only.
  const revisions = savingPlan?.revisions ?? null;
  const chartDayKeys = lastSevenDateKeys();
  const expectedDailySeries = revisions
    ? chartDayKeys.map(key => plannedAmountForDate(revisions, key, planPauses))
    : undefined;
  // Daily Deposit Trend series (Task 38.1).
  // Purpose-filtered daily series per member axis:
  // - `Total` aggregates every visible room member's daily totals.
  // - `Me` is the current user's daily series only.
  // - `Compare` is current user vs ONE selected other member.
  // Purpose is applied first (filter by category/bucket), then member.
  const meDailySeries = purposeFilteredDailySeries(logs, purposeScope, visibleBucketsById, user?.id);
  const meDailyMarkers = purposeDailyMarkers(
    logs,
    purposeScope,
    visibleBucketsById,
    user?.id,
    undefined,
    { revealBucketNamesForUserId: user?.id ?? null },
  );
  const otherDailySeriesByUserId = otherMemberIds.reduce<Record<string, number[]>>((acc, id) => {
    acc[id] = purposeFilteredDailySeries(logs, purposeScope, visibleBucketsById, id);
    return acc;
  }, {});
  const otherDailyMarkersByUserId = otherMemberIds.reduce<Record<string, ReturnType<typeof purposeDailyMarkers>>>((acc, id) => {
    acc[id] = purposeDailyMarkers(
      logs,
      purposeScope,
      visibleBucketsById,
      id,
      undefined,
      { revealBucketNamesForUserId: null },
    );
    return acc;
  }, {});
  const roomDailySeries = otherMemberIds.reduce<number[]>(
    (acc, id) => {
      const series = otherDailySeriesByUserId[id] ?? [];
      return acc.map((value, index) => value + (series[index] ?? 0));
    },
    meDailySeries.slice(),
  );
  const roomDailyMarkers = purposeDailyMarkers(
    logs,
    purposeScope,
    visibleBucketsById,
    undefined,
    undefined,
    { revealBucketNamesForUserId: user?.id ?? null },
  );
  const compareSelectedSeries = compareMemberId
    ? otherDailySeriesByUserId[compareMemberId] ?? null
    : null;
  const compareSelectedMarkers = compareMemberId
    ? otherDailyMarkersByUserId[compareMemberId] ?? null
    : null;
  const weekRecordedTotal = meDailySeries.reduce((sum, v) => sum + v, 0);
  const roomWeekTotal = roomDailySeries.reduce((sum, v) => sum + v, 0);
  const compareSelectedTotal = compareSelectedSeries
    ? compareSelectedSeries.reduce((sum, v) => sum + v, 0)
    : 0;
  const compareSelectedEntry = compareMemberId
    ? leaderboard.entries.find(entry => entry.userId === compareMemberId) ?? null
    : null;

  const trendModeOptions: Array<{ value: DailyTrendMode; label: string }> = [
    { value: 'room', label: d.dailyDepositModeRoom },
    { value: 'me', label: d.dailyDepositModeMe },
    { value: 'compare', label: d.dailyDepositModeCompare },
  ];
  const hasOtherMembers = otherMemberIds.length > 0;

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
  const leaderboardEntries: PlayerProgressEntry[] = useMemo(() => leaderboard.entries.length > 0
    ? leaderboard.entries.map(entry => ({
        userId: entry.userId,
        name: entry.isYou ? youName : (entry.displayName ?? d.partnerLabel),
        fallback: fallbackInitial(entry.displayName ?? (entry.isYou ? profile?.display_name : d.partnerLabel)),
        imageUrl: entry.avatarUrl,
        saved: entry.saved,
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
      }] : []), [leaderboard.entries, youName, d.partnerLabel, profile?.display_name, profile?.avatar_url, profile?.theme_color, user, total, target]);

  const chartLocale = language === 'th' ? 'th-TH' : 'en-US';

  function handleBucketCategoryChange(next: BucketCategory) {
    setBucketCategory(next);
    setBucketName(currentName =>
      shouldAutofillBucketName(currentName, copy.bucket.defaultNames)
        ? copy.bucket.defaultNames[next]
        : currentName,
    );
  }

  const renderLeaderboardTrailing = useCallback((entry: PlayerProgressEntry) => (
    <NudgeButton
      partnerUserId={entry.userId}
      roomId={activeRoomId}
      partnerName={entry.name}
    />
  ), [activeRoomId]);

  const handleLeaderboardRowClick = useCallback((entry: PlayerProgressEntry) => {
    if (entry.isYou) {
      navigate('/profile');
      return;
    }
    navigate(`/members/${entry.userId}`);
  }, [navigate]);

  const handleCheckBalance = useCallback(() => navigate('/check-balance'), [navigate]);
  const handleConfigurePlan = useCallback(() => {
    if (buckets.length > 0) {
      setManageBucketsOpen(true);
    } else {
      setBucketModalOpen(true);
    }
  }, [buckets.length]);
  const handleDepositFromPlan = useCallback(() => navigate('/add'), [navigate]);
  function bucketDraftFromExisting(bucket: Bucket) {
    return {
      id: bucket.id,
      name: bucket.name,
      target_amount: bucket.target_amount,
      category: bucket.category,
      deadline: bucket.deadline,
      saving_rule_type: bucket.saving_rule_type,
      saving_rule_amount: bucket.saving_rule_amount,
      saving_rule_start_amount: bucket.saving_rule_start_amount,
      saving_rule_increment: bucket.saving_rule_increment,
      saving_rule_cap: bucket.saving_rule_cap,
      saving_rule_day_count: bucket.saving_rule_day_count,
      reminder_day: bucket.reminder_day,
      payment_type: bucket.payment_type,
    };
  }

  async function handleMigrationStart() {
    migration.setState(current => ({
      ...current,
      step: Math.max(1, current.step),
      dismissed: false,
    }));
  }

  function handleMigrationBack() {
    migration.setState(current => ({
      ...current,
      step: Math.max(0, current.step - 1),
      dismissed: false,
    }));
  }

  function handleMigrationLater() {
    migration.markDismissed();
    setMigrationBannerDismissed(false);
  }

  async function handleMigrationBucketSubmit(bucket: Bucket, ruleData: BucketCreateRuleData) {
    const result = await saveBuckets(
      buckets.map(item => item.id === bucket.id
        ? {
            ...bucketDraftFromExisting(item),
            deadline: ruleData.deadline,
            saving_rule_type: ruleData.savingRuleType,
            saving_rule_amount: ruleData.savingRuleAmount,
            saving_rule_start_amount: ruleData.savingRuleStartAmount,
            saving_rule_increment: ruleData.savingRuleIncrement,
            saving_rule_cap: ruleData.savingRuleCap,
            saving_rule_day_count: ruleData.savingRuleDayCount,
            reminder_day: ruleData.reminderDay,
          }
        : bucketDraftFromExisting(item)),
    );
    if (!result.error) {
      migration.markBucketCompleted(bucket.id);
      haptic('success');
    }
    return result;
  }

  async function handleMigrationComplete() {
    const result = await data.savingPlan.archivePlan();
    if (result.error) return result;
    migration.markDone();
    await refreshAll();
    haptic('success');
    return {};
  }

  async function handleCreateBucket(ruleData: BucketCreateRuleData) {
    const nextTarget = Number(bucketTarget);
    if (!bucketCategory || !bucketName.trim() || nextTarget <= 0) {
      setMessage(copy.bucket.validationNameAndTarget);
      return;
    }
    if (hasDuplicateBucketName(buckets, bucketName)) {
      setMessage(copy.bucket.duplicateName(bucketName.trim()));
      return;
    }
    if (newBucketExceedsCapacity) {
      setMessage(copy.bucket.capacityError(formatMoney(bucketTargetRemaining ?? 0)));
      return;
    }
    const result = await saveBuckets([
      ...buckets,
      {
        id: undefined,
        name: bucketName.trim(),
        target_amount: nextTarget,
        category: bucketCategory,
        deadline: ruleData.deadline,
        saving_rule_type: ruleData.savingRuleType,
        saving_rule_amount: ruleData.savingRuleAmount,
        saving_rule_start_amount: ruleData.savingRuleStartAmount,
        saving_rule_increment: ruleData.savingRuleIncrement,
        saving_rule_cap: ruleData.savingRuleCap,
        saving_rule_day_count: ruleData.savingRuleDayCount,
        reminder_day: ruleData.reminderDay,
      },
    ]);
    if (result.error) {
      setMessage(result.code === 'duplicate_name'
        ? copy.bucket.duplicateName(result.duplicateName ?? bucketName.trim())
        : result.error);
    } else {
      setMessage(null);
      setBucketCategory(DEFAULT_BUCKET_CATEGORY);
      setBucketName(copy.bucket.defaultNames[DEFAULT_BUCKET_CATEGORY]);
      setBucketTarget('');
      setBucketModalOpen(false);
    }
  }

  async function handleManageBucketUpdate(bucket: Bucket, next: { name: string; target_amount: number; deadline?: string | null; saving_rule_type?: SavingRuleType | null; saving_rule_amount?: number | null; reminder_day?: number | null }) {
    if (hasDuplicateBucketName(buckets, next.name, bucket.id)) {
      const error = copy.bucket.duplicateName(next.name.trim());
      return { error, code: 'duplicate_name' as const, duplicateName: next.name.trim() };
    }
    if (target > 0) {
      const capacityForBucket = target - (bucketTargetTotal - bucket.target_amount);
      if (next.target_amount > capacityForBucket) {
        const error = copy.bucket.capacityErrorForEdit(formatMoney(Math.max(0, capacityForBucket)));
        return { error };
      }
    }
    const result = await saveBuckets(
      buckets.map(item => item.id === bucket.id
        ? {
            id: item.id,
            name: next.name,
            target_amount: next.target_amount,
            category: item.category,
            ...(next.deadline !== undefined && { deadline: next.deadline }),
            ...(next.saving_rule_type !== undefined && { saving_rule_type: next.saving_rule_type }),
            ...(next.saving_rule_amount !== undefined && { saving_rule_amount: next.saving_rule_amount }),
            ...(next.reminder_day !== undefined && { reminder_day: next.reminder_day }),
          }
        : { id: item.id, name: item.name, target_amount: item.target_amount, category: item.category }),
    );
    if (result.error) {
      return {
        ...result,
        error: result.code === 'duplicate_name'
          ? copy.bucket.duplicateName(result.duplicateName ?? next.name.trim())
          : result.error,
      };
    }
    // Insert deadline revision and check for frequent extensions
    if (next.deadline !== undefined && next.deadline !== (bucket.deadline ?? null) && user) {
      void supabase.from('bucket_deadline_revisions').insert({
        bucket_id: bucket.id,
        previous_deadline: bucket.deadline ?? null,
        new_deadline: next.deadline,
        changed_by: user.id,
      });
      const { count } = await supabase
        .from('bucket_deadline_revisions')
        .select('id', { count: 'exact', head: true })
        .eq('bucket_id', bucket.id);
      if (count != null && count >= 3) {
        haptic('success');
        return { ...result, deadlineExtensionWarning: true };
      }
    }
    haptic('success');
    return result;
  }

  if (!isRefreshing && loading && shouldShowSkeleton) return <DashboardSkeleton />;
  if (!isRefreshing && loading) return null;
  if (error) return <DashboardStatusCard title={d.errorTitle} body={error} />;

  return (
    <PullToRefresh onRefresh={refreshAll}>
      {createPortal(
        <div aria-hidden className="dashboard-mesh-bg pointer-events-none fixed inset-0 -z-10" />,
        document.body,
      )}
    <motion.div className="flex flex-col gap-6 pt-8 pb-6" variants={containerVariants} initial="hidden" animate="visible">
      {/* Project header. Compact, no heavy card. */}
      <motion.header
        className="flex items-start justify-between gap-3"
        variants={sectionVariants}
      >
        <div className="min-w-0 flex-1">
          <div className="flex max-w-full flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="min-w-0 break-words font-mono text-2xl font-bold leading-tight text-ink">
              {activeRoom?.name ?? 'Japan 2027'}
            </h1>
            <div className="flex shrink-0 items-center gap-1.5 text-ink-muted" aria-label={d.membersInRoom(leaderboard.entries.length)}>
              <IconUser size={14} />
              <span className="font-mono text-xs">
                {leaderboard.entries.length}
              </span>
            </div>
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
      {showMigrationBanner && (
        <motion.div variants={sectionVariants} className="rounded-xl bg-surface p-4 shadow-soft">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <IconCalendar size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-mono text-sm font-bold text-ink">{copy.migrationWizard.bannerTitle}</h2>
              <p className="mt-1 font-mono text-xs leading-relaxed text-ink-muted">
                {copy.migrationWizard.bannerBody}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="action" size="sm" onClick={handleMigrationStart}>
                  {copy.migrationWizard.bannerContinue}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setMigrationBannerDismissed(true)}>
                  {copy.migrationWizard.bannerDismiss}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div variants={sectionVariants}>
        <HeroCard
          displayName={youName}
          saved={total}
          target={target}
          roomName={activeRoom?.name ?? null}
          roomCategory={activeRoom?.category ?? null}
          coverImageUrl={activeRoom?.cover_image_url ?? null}
          validThru={activeRoom?.end_date ?? null}
          dailySummaryItem={bucketSummaryItems[0] ?? null}
          hasBuckets={buckets.length > 0}
          streak={heroStreak}
          streakUnit={heroStreakUnit}
        />
      </motion.div>

      {/* 2 — Progress Race (N-aware leaderboard). */}
      <motion.div variants={sectionVariants}>
        <RoomLeaderboardList
          entries={leaderboardEntries}
          emptyBody={d.invitePartnerHint}
          renderRowTrailing={renderLeaderboardTrailing}
          onRowClick={handleLeaderboardRowClick}
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
              onCheck={handleCheckBalance}
            />
          </div>
        )}
        <SavingPlanCard
          ruleType={displayRevision?.rule_type ?? null}
          money={moneyStatus}
          habit={displayedHabitStatus}
          onConfigure={handleConfigurePlan}
          verifiedBalance={verifiedBalanceSlot}
          isPaused={isPausedToday}
          pausedSince={pausedSince}
          planSummary={planSummary}
          lastFreezeDateKey={lastStreakFreezeDate}
          todayDateKey={todayKey}
          planStartDateKey={displayRevision?.effective_from_date ?? null}
          daysRemaining={planDaysRemaining}
          progressPct={planProgressPct}
          bucketSummaryItems={bucketSummaryItems}
          hasBucketRules={hasBucketRules}
          onDeposit={handleDepositFromPlan}
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
        {(() => {
          const memberPicker = hasOtherBuckets ? (
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
          ) : null;
          return activeOtherGroup ? (
          <BucketGrid
            title={d.yourBuckets(activeOtherGroup.name)}
            subtitle={`${d.bucketCount(activeOtherGroup.items.length)} — ${d.bucketReadOnly}`}
            buckets={activeOtherGroup.items}
            belowHeader={memberPicker}
            renderBucket={bucket => (
              <BucketRow
                icon={bucket.icon}
                name={bucket.name}
                saved={bucket.saved}
                target={bucket.target}
                status={bucket.status}
                deadline={bucket.deadline}
                pace={bucket.pace}
              />
            )}
          />
        ) : (
          <DndContext
            sensors={dragSensors}
            modifiers={bucketDragModifiers}
            onDragStart={handleBucketDragStart}
            onDragEnd={handleBucketDragEnd}
          >
            <BucketGrid
              title={d.tripBuckets}
              subtitle={buckets.length > 0 ? d.bucketCount(activeBucketItems.length) : undefined}
              buckets={activeBucketItems}
              ctaLabel={buckets.length > 0 ? d.addBucket : d.createBucket}
              onAddBucket={() => setBucketModalOpen(true)}
              manageLabel={buckets.length > 0 ? d.manageBuckets : undefined}
              onManageBuckets={buckets.length > 0 ? () => setManageBucketsOpen(true) : undefined}
              belowHeader={
                <div className="flex flex-col gap-3">
                  {memberPicker}
                  {nextBucketId && (() => {
                    const nextBucket = bucketItems.find(b => b.id === nextBucketId);
                    if (!nextBucket) return null;
                    return (
                      <div className="flex items-center gap-2 rounded-lg bg-surfaceAlt px-3 py-2">
                        <span className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-ink-muted">
                          {copy.bucketIntent.nextStrip(nextBucket.name)}
                        </span>
                        <Button variant="link" size="sm" onClick={() => setNextPickerOpen(true)} className="shrink-0">
                          {copy.bucketIntent.changeNext}
                        </Button>
                      </div>
                    );
                  })()}
                  <BucketDragHint
                    open={showBucketDragHint}
                    message={copy.bucketDragHint.message}
                    dismissAriaLabel={copy.bucketDragHint.dismissAriaLabel}
                    onShown={handleBucketDragHintShown}
                    onDismiss={handleBucketDragHintDismiss}
                  />
                </div>
              }
              renderBucket={bucket => (
                <BucketDragCard
                  id={bucket.id}
                  dragHintRole={
                    bucketDragHintDemo?.sourceId === bucket.id
                      ? 'source'
                      : bucketDragHintDemo?.destinationId === bucket.id
                        ? 'target'
                        : undefined
                  }
                  dragHintOffset={bucketDragHintDemo?.sourceId === bucket.id ? bucketDragHintDemo.offset : undefined}
                >
                  <BucketRow
                    icon={bucket.icon}
                    name={bucket.name}
                    saved={bucket.saved}
                    target={bucket.target}
                    status={bucket.status}
                    deadline={bucket.deadline}
                    pace={bucket.pace}
                    onClick={() => setExpandedBucketId(bucket.id)}
                  />
                </BucketDragCard>
              )}
            />
          </DndContext>
        );
        })()}
        {completedBucketItems.length > 0 && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setCompletedBucketsOpen(prev => !prev)}
              className="flex items-center gap-2 rounded-lg bg-surfaceAlt px-3 py-2 text-left"
            >
              <span className="min-w-0 flex-1 font-mono text-xs font-bold text-ink-muted">
                {copy.bucketIntent.status.done} ({completedBucketItems.length})
              </span>
              <span className={`text-ink-dim transition-transform ${completedBucketsOpen ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>
            {completedBucketsOpen && (
              <div className="grid grid-cols-2 gap-4 p-1">
                {completedBucketItems.map(bucket => (
                  <BucketRow
                    key={bucket.id}
                    icon={bucket.icon}
                    name={bucket.name}
                    saved={bucket.saved}
                    target={bucket.target}
                    status={bucket.status}
                    onClick={() => setExpandedBucketId(bucket.id)}
                  />
                ))}
              </div>
            )}
          </div>
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
          series={chartSeries}
          partnerSeries={chartPartnerSeries}
          labels={lastSevenDayLabels(undefined, chartLocale)}
          barMarkers={chartBarMarkers}
          partnerBarMarkers={chartPartnerBarMarkers}
          yourName={profile?.display_name ?? d.youLabel}
          partnerName={chartSecondaryLabel}
          primaryLabel={chartPrimaryLabel}
          secondaryLabel={chartSecondaryLabel}
          displayedTotal={chartDisplayedTotal}
          emptyStateMessage={selectedPurposeEmptyMessage}
          purposePicker={purposeCategories.length > 0 ? (
            <MomentumPurposePicker
              categories={purposeCategories}
              buckets={purposePickerBuckets}
              value={purposeScope}
              onChange={setPurposeScope}
              hideBucketRow={effectiveTrendMode !== 'me'}
/>
          ) : undefined}
          modeControl={hasOtherMembers ? (
            <DailyTrendModeControl
              ariaLabel={d.dailyDepositModeAria}
              options={trendModeOptions}
              value={effectiveTrendMode}
              onChange={setTrendMode}
              disabledValues={purposeScope.kind === 'bucket' ? ['room', 'compare'] : undefined}
            />
          ) : undefined}
          compareChips={hasOtherMembers && effectiveTrendMode === 'compare' ? (
            <CompareMemberDropdown
              ariaLabel={d.dailyDepositCompareAria}
              members={otherMemberIds.map(id => {
                const entry = leaderboard.entries.find(e => e.userId === id);
                return {
                  userId: id,
                  displayName: entry?.displayName ?? d.partnerLabel,
                  avatarUrl: entry?.avatarUrl ?? null,
                  themeColor: entry?.themeColor,
                };
              })}
              selectedId={compareMemberId}
              onSelect={setCompareMemberId}
            />
          ) : undefined}
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
          <DashboardStatusCard title={d.noActivityYet} body={d.noActivityBody(formatMoney(100))} />
        )}
        <ActivityHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          items={activityItems}
          bucketEvents={bucketEventItems}
        />
      </motion.section>

      <MigrationWizard
        open={migrationWizardOpen}
        state={migration.state}
        buckets={migrationBuckets}
        logs={logs}
        transfers={bucketTransfers}
        roomEndDate={activeRoom?.end_date ?? null}
        summaryItems={bucketSummaryItems}
        streak={displayedHabitStatus.streak ?? 0}
        streakUnit={'streakUnit' in displayedHabitStatus ? displayedHabitStatus.streakUnit : undefined}
        onStart={handleMigrationStart}
        onBack={handleMigrationBack}
        onLater={handleMigrationLater}
        onBucketSubmit={handleMigrationBucketSubmit}
        onComplete={handleMigrationComplete}
      />

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
            onCategoryChange={handleBucketCategoryChange}
            onNameChange={setBucketName}
            onTargetChange={value => setBucketTarget(value.replace(/[^0-9]/g, ''))}
            onSubmit={handleCreateBucket}
            roomEndDate={activeRoom?.end_date ?? null}
          />
        </div>
      </Modal>

      <Modal
        open={manageBucketsOpen}
        title={copy.manageProject.manageBucketsModalTitle}
        onClose={() => { setManageBucketsOpen(false); setManageBucketTransferSheetOpen(false); }}
        hidden={manageBucketTransferSheetOpen}
      >
        <BucketManager
          buckets={buckets}
          logs={logs}
          transfers={bucketTransfers}
          goalTarget={target > 0 ? target : null}
          onUpdate={handleManageBucketUpdate}
          onReviewCategories={async (updates) => {
            const result = await reviewBucketCategories(updates);
            if (!result.error) {
              for (const u of updates) {
                logIntentEvent({
                  eventKey: 'category_reviewed',
                  bucketId: u.id,
                  payload: { category: u.category },
                });
              }
            }
            return result;
          }}
          onTransferSheetOpenChange={setManageBucketTransferSheetOpen}
          onRemoved={refetchBuckets}
        />
      </Modal>

      <BucketNextPickerModal
        open={nextPickerOpen}
        buckets={bucketItems
          .filter(b => !doneBucketIds.has(b.id) && b.id !== focusBucketId)
          .map(b => ({ id: b.id, name: b.name, category: b.category, saved: b.saved, target: b.target }))}
        currentNextBucketId={nextBucketId}
        onSelect={async (bucketId) => {
          const result = await setManualNextBucket(bucketId);
          if (!result.error) {
            void logIntentEvent({ eventKey: 'next_bucket_selected', bucketId });
          }
        }}
        onClear={async () => {
          const result = await setManualNextBucket(null);
          if (!result.error) {
            void logIntentEvent({ eventKey: 'next_bucket_cleared' });
          }
        }}
        onClose={() => setNextPickerOpen(false)}
      />

      <VerifiedBalanceReminderModal
        open={vbReminder.open}
        daysSinceLast={vbReminder.days}
        onClose={closeVbReminder}
        onCheckNow={() => {
          closeVbReminder();
          navigate('/check-balance');
        }}
      />

      {/* Bucket-to-bucket transfer sheet (drag-shortcut entry, slice 40.6). */}
      <BucketTransferSheet
        open={transferIntent !== null}
        onClose={() => setTransferIntent(null)}
        buckets={bucketItems}
        initialSourceId={transferIntent?.sourceId ?? null}
        initialDestinationId={transferIntent?.destinationId ?? null}
        initialAmount={transferIntent?.initialAmount ?? null}
        suggestionReason={transferIntent?.suggestionReason ?? null}
        onSuggestionShown={() => {
          void logIntentEvent({ eventKey: 'transfer_suggested' });
        }}
        onSuccess={(result) => {
          if (activeRoomId && user?.id) {
            upsertTransfer({
              id: result.transfer_id,
              room_id: activeRoomId,
              user_id: user.id,
              source_bucket_id: result.source_bucket_id,
              destination_bucket_id: result.destination_bucket_id,
              amount: result.amount,
              note: null,
              client_request_id: '',
              created_at: result.created_at,
            });
          }
          void logIntentEvent({
            eventKey: 'transfer_completed',
            bucketId: result.source_bucket_id,
            payload: {
              destination_bucket_id: result.destination_bucket_id,
              amount: result.amount,
            },
          });
          haptic('success');
          setTransferIntent(null);
        }}
      />

      {/* Bucket deposit bottom sheet */}
      {(() => {
        const selectedBucketItem = bucketItems.find(b => b.id === expandedBucketId);
        const isDone = selectedBucketItem?.status?.kind === 'done';
        const extraAmt = isDone && selectedBucketItem
          ? Math.max(0, selectedBucketItem.saved - selectedBucketItem.target)
          : 0;
        const nextBucket = nextBucketId
          ? bucketItems.find(b => b.id === nextBucketId)
          : null;
        return (
          <BucketSheet
            open={Boolean(expandedBucketId)}
            onClose={() => setExpandedBucketId(null)}
            bucketId={expandedBucketId ?? ''}
            icon={selectedBucketItem?.icon ?? null}
            name={selectedBucketItem?.name ?? ''}
            saved={selectedBucketItem?.saved ?? 0}
            target={selectedBucketItem?.target ?? 0}
            quickAmounts={quickAmounts}
            smartDefaultAmount={smartDefault.value}
            isComplete={isDone}
            extraAmount={extraAmt}
            nextBucketName={nextBucket?.name ?? null}
            onRequestTransferExtra={(sourceBucketId) => {
              setExpandedBucketId(null);
              const srcBkt = bucketItems.find(b => b.id === sourceBucketId);
              const destId = nextBucketId ?? bucketItems.find(b => b.id !== sourceBucketId)?.id ?? null;
              const destBkt = destId ? bucketItems.find(b => b.id === destId) : null;
              const extra = srcBkt ? Math.max(0, srcBkt.saved - srcBkt.target) : 0;
              const reason = destBkt && destBkt.id === nextBucketId
                ? copy.bucketTransfer.suggestion.completedToNext(srcBkt?.name ?? '', destBkt.name)
                : copy.bucketTransfer.suggestion.completedExtra(srcBkt?.name ?? '');
              setTransferIntent({
                sourceId: sourceBucketId,
                destinationId: destId,
                initialAmount: extra > 0 ? extra : null,
                suggestionReason: reason,
              });
            }}
            onDoneLockOverride={(bId) => {
              void logIntentEvent({ eventKey: 'done_lock_overridden', bucketId: bId });
            }}
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
                if (selectedBucketItem) {
                  setVaultPreview({
                    prevSaved: totalSaved,
                    newSaved: totalSaved + amount,
                    target: totalTarget,
                    depositAmount: amount,
                    bucketName: selectedBucketItem.name,
                    reachedBucket: reached,
                  });
                }
                setExpandedBucketId(null);
              }
              return result;
            }}
          />
        );
      })()}
      <VaultUpdatePreviewModal
        open={vaultPreview !== null}
        prevSaved={vaultPreview?.prevSaved ?? 0}
        newSaved={vaultPreview?.newSaved ?? 0}
        target={vaultPreview?.target ?? 0}
        depositAmount={vaultPreview?.depositAmount ?? 0}
        bucketName={vaultPreview?.bucketName ?? ''}
        reachedBucket={vaultPreview?.reachedBucket ?? false}
        cardholderNames={leaderboardEntries.map(e => e.name)}
        validThru={activeRoom?.end_date ?? null}
        onDone={() => setVaultPreview(null)}
      />
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
    <div className="flex flex-col gap-6 pt-8 animate-fade-in" aria-label={copy.common.loadingDashboard}>
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
  transfers: BucketTransfer[],
  copy: ReturnType<typeof useI18n>['copy']['dashboard'],
  formatMoney: (amount: number) => string,
) {
  const bucket = buckets
    .map(item => ({ bucket: item, saved: bucketSaved(item.id, logs, transfers) }))
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
  return <BucketCategoryIcon category={category} size={22} />;
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

const BUCKET_MEMBER_PICKER_HINT_STORAGE_KEY = 'bucket-member-picker-hint-seen-v1';

/** Dashboard-scoped horizontal member picker for the Smart Buckets
 *  section. Replaces the right-aligned `Segmented` control so 3-7
 *  member rooms can scroll cleanly on mobile without clipping the
 *  first option, wrapping tab labels, or detaching from the bucket
 *  section. Selection state mirrors the previous tab-pill look. */
function BucketMemberPicker({ ariaLabel, options, value, onChange }: BucketMemberPickerProps) {
  const [showHint, setShowHint] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(BUCKET_MEMBER_PICKER_HINT_STORAGE_KEY)) return;
    } catch {
      return;
    }
    const el = shellRef.current;
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
        try { window.localStorage.setItem(BUCKET_MEMBER_PICKER_HINT_STORAGE_KEY, '1'); } catch { /* ignore */ }
      }, 6400);
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(startId);
      window.clearTimeout(endId);
    };
  }, []);

  return (
    <LayoutGroup id="bucket-member-pill">
      <div
        ref={shellRef}
        className="relative inline-flex w-fit max-w-full self-start overflow-hidden rounded-pill"
      >
        {showHint && (
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
      <ScrollFadeContainer
        className="inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-pill bg-well p-1 shadow-neuPressed"
        fadeColor="#F1E7DC"
        fadeWidth={20}
      >
        <div
          role="tablist"
          aria-label={ariaLabel}
          className="inline-flex items-center gap-1"
        >
          {options.map(option => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                title={option.label}
                onClick={() => onChange(option.value)}
                className={
                  'relative inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-pill px-3.5 py-1.5 font-mono text-xs font-bold transition-colors '
                  + (active ? 'text-ink-inverse' : 'text-ink-muted')
                }
              >
                {active && (
                  <motion.span
                    layoutId="bucket-member-active-pill"
                    className="absolute inset-0 rounded-pill bg-brand-500 shadow-haloOrange"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative z-10 whitespace-nowrap">
                  {option.label.length > 11 ? `${option.label.slice(0, 11)}…` : option.label}
                </span>
              </button>
            );
          })}
        </div>
      </ScrollFadeContainer>
      </div>
    </LayoutGroup>
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
 *  language so the Dashboard stays visually coherent on mobile. No
 *  browser-default select/dropdown, no emoji. */
const TREND_MODE_HINT_STORAGE_KEY = 'daily-trend-mode-hint-seen-v1';

function DailyTrendModeControl({ ariaLabel, options, value, onChange, disabledValues }: DailyTrendModeControlProps) {
  // First-visit shimmer: sweep a soft sheen across the toggle once
  // *after the card scrolls into view*, so users who never reach the
  // Daily Trend section don't burn their one-time hint. Stored per
  // browser; respects prefers-reduced-motion via framer-motion.
  const [showHint, setShowHint] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
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
      // Three sweeps × 2s each + 350ms lead-in ≈ 6.4s total before the
      // hint is marked seen, giving the user plenty of chances to catch it.
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
  }, []);

  return (
    <LayoutGroup id="trend-mode-pill">
      <div
        ref={trackRef}
        role="tablist"
        aria-label={ariaLabel}
        className="relative inline-flex h-10 w-fit items-center gap-1 self-start overflow-hidden rounded-pill bg-well p-1 shadow-[inset_2px_2px_5px_rgba(120,89,61,0.16),inset_-2px_-2px_5px_rgba(255,255,255,0.62)]"
      >
        {showHint && (
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
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
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

/** Compact dropdown for choosing the Compare-mode member inside the
 *  Daily Deposit Trend card. The menu expands in-place so the chart
 *  card can grow/shrink smoothly without an overlay clipping against
 *  the card's rounded, overflow-hidden shell. */
function CompareMemberDropdown({ ariaLabel, members, selectedId, onSelect }: CompareMemberDropdownProps) {
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
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
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
            initial={{ opacity: 0, scaleY: 0.86, y: -4 }}
            animate={{ opacity: 1, scaleY: 1, y: 0 }}
            exit={{ opacity: 0, scaleY: 0.9, y: -3 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.2, 1] }}
            className="absolute left-0 top-full mt-1 w-full origin-top overflow-hidden"
          >
            <motion.div
              role="listbox"
              aria-label={ariaLabel}
              className="mt-1 flex max-h-44 flex-col gap-1 overflow-y-auto rounded-[1rem] bg-well p-1 shadow-[inset_1px_1px_3px_rgba(120,89,61,0.12),inset_-1px_-1px_3px_rgba(255,255,255,0.5)]"
              initial="closed"
              animate="open"
              exit="closed"
              variants={{
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
                      closed: { opacity: 0, x: -6 },
                    }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className={
                      'relative flex h-9 w-full min-w-0 items-center gap-1.5 rounded-xl px-1.5 pr-2 font-mono text-[11px] font-bold transition-colors '
                      + (active ? 'text-ink-inverse' : 'text-ink-muted hover:bg-surface/70')
                    }
                  >
                    {active && (
                      <motion.span
                        layoutId="compare-member-dropdown-active"
                        className="absolute inset-0 rounded-xl bg-brand-500"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
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
