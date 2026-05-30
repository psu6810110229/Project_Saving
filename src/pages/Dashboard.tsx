import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ALLOCATION_DRAG_ID, BalanceCheckStatus } from '../components/BalanceCheckStatus/BalanceCheckStatus';
import { AllocateSheet } from '../components/AllocateSheet/AllocateSheet';
import { CheckBalanceSheet } from '../components/CheckBalanceSheet/CheckBalanceSheet';
import { MigrationWizard } from '../components/MigrationWizard/MigrationWizard';
import { BucketRow } from '../components/BucketRow/BucketRow';
import { BucketGrid } from '../components/BucketGrid/BucketGrid';
import { BucketEditForm } from '../components/BucketEditForm/BucketEditForm';
import { BucketManager } from '../components/BucketManager/BucketManager';
import { BucketSheet } from '../components/BucketSheet/BucketSheet';
import { BucketDragCard } from '../components/BucketDragCard/BucketDragCard';
import { SortableBucketCard } from '../components/SortableBucketCard/SortableBucketCard';
import { RemoveBucketModal, type RemoveBucketDestination } from '../components/RemoveBucketModal/RemoveBucketModal';

import { BucketTransferSheet } from '../components/BucketTransferSheet/BucketTransferSheet';
import { ActionAlert, type ActionAlertBucket } from '../components/ActionAlert/ActionAlert';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
  type Modifiers,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '../components/Button/Button';
import { CreateBucketForm } from '../components/CreateBucketForm/CreateBucketForm';
import { IconButton } from '../components/IconButton/IconButton';
import { MicroGoalCard } from '../components/MicroGoalCard/MicroGoalCard';
import { HeroCard } from '../components/HeroCard/HeroCard';
import { SavingsHeatmap } from '../components/SavingsHeatmap/SavingsHeatmap';
import { HeroCoverPicker } from '../components/HeroCoverPicker/HeroCoverPicker';
import type { HeroCoverPreset } from '../lib/heroCovers';
import { ImageCropper } from '../components/ImageCropper/ImageCropper';
import { VaultUpdatePreviewModal } from '../components/VaultUpdatePreviewModal/VaultUpdatePreviewModal';
import { VerifiedBalanceReminderModal } from '../components/VerifiedBalanceReminderModal/VerifiedBalanceReminderModal';
import { BellIconButton } from '../components/Notifications/BellIconButton';
import { useUnreadNotificationsCount } from '../hooks/useUnreadNotificationsCount';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import {
  IconCalendar,
  IconCheck,
  IconEdit,
  IconRocket,
  IconUser,
  IconX,
} from '../components/Icon/Icon';
import { BucketCategoryIcon } from '../components/BucketCategoryIcon/BucketCategoryIcon';
import { PullToRefresh } from '../components/PullToRefresh/PullToRefresh';
import { BUCKET_CATEGORY_ORDER } from '../lib/bucketCategories';
import { calcDailySummary } from '../lib/bucketDailySummary';
import { calcPeriodAwareStreak } from '../lib/streakCalculation';
import { Modal } from '../components/Modal/Modal';
import { OutcomeModal } from '../components/OutcomeModal/OutcomeModal';
import { useAuth } from '../hooks/useAuth';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useSharedData } from '../hooks/useSharedData';
import { useMigrationState } from '../hooks/useMigrationState';
import { useLogs } from '../hooks/useLogs';
import { useBucketIntentSettings } from '../hooks/useBucketIntentSettings';
import { type ArchiveErrorHint, useArchiveBucket } from '../hooks/useArchiveBucket';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import { useImageUpload, type CropRect } from '../hooks/useImageUpload';
import { useSavingsTotal } from '../hooks/useSavingsTotal';
import { useSmartDefaultAmount } from '../hooks/useSmartDefaultAmount';
import { useI18n } from '../i18n/useI18n';
import { bucketSaved, hasDuplicateBucketName, shouldAutofillBucketName, sumTargets } from '../lib/buckets';
import { calcBucketPace } from '../lib/paceCalculation';
import { cumulativeAmountSeries } from '../lib/dashboardStats';
import { haptic } from '../lib/haptics';
import { roomCoverErrorMessage } from '../lib/roomCoverImage';
import { supabase } from '../lib/supabase';
import { daysSince } from '../lib/reconcile';
import {
  daysBetween,
  todayBangkokKey,
} from '../lib/savingPlan';
import type { Bucket, BucketCategory, BucketCreateRuleData, BucketTransfer, SavingRuleType } from '../types';

/** Framer Motion stagger variants for the Dashboard cascade. */
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.16, 1, 0.2, 1] },
  },
};

const reducedContainerVariants = {
  hidden: {},
  visible: {},
};

const reducedSectionVariants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
};

// First dashboard view of the session plays a richer, strictly sequential
// entrance — staggerChildren (0.22) > section duration (0.2) so each section
// finishes before the next begins. Later in-session visits use the quieter
// variants above.
const immersiveContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.22, delayChildren: 0.12 } },
};

const immersiveSectionVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: [0.16, 1, 0.2, 1] },
  },
};

const DASHBOARD_IMMERSIVE_SESSION_KEY = 'dashboardImmersiveSeen';

// Toggle to re-enable the "Next Win" micro-goal block without
// untangling its data preparation. Kept off-canvas while the
// Dashboard hierarchy focuses on Vault / Race / Plan.
const SHOW_NEXT_WIN = false;

// Session-scoped flag so the Verified Balance reminder popup does not
// respawn after a dismissal or after the user taps "Check now". Survives
// in-tab remounts; clears naturally when the browser tab closes.
const VB_REMINDER_SESSION_KEY = 'verifiedBalanceReminderDismissed';

type BucketDragMode = 'transfer' | 'edit';

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

function mapArchiveHintToErrorKey(
  hint: ArchiveErrorHint,
): keyof ReturnType<typeof useI18n>['copy']['bucketRemove']['errors'] {
  switch (hint) {
    case 'archive_unauthenticated': return 'unauthenticated';
    case 'archive_invalid_request': return 'invalid_request';
    case 'archive_bucket_missing': return 'bucket_missing';
    case 'archive_partner_bucket': return 'partner_bucket';
    case 'archive_not_room_member': return 'not_room_member';
    case 'archive_nonzero_balance': return 'nonzero_balance';
    case 'archive_last_active': return 'last_active';
    case 'archive_same_bucket': return 'same_bucket';
    case 'archive_source_missing': return 'source_missing';
    case 'archive_destination_missing': return 'destination_missing';
    case 'archive_partner_source': return 'partner_source';
    case 'archive_partner_destination': return 'partner_destination';
    case 'archive_source_archived': return 'source_archived';
    case 'archive_destination_archived': return 'destination_archived';
    case 'archive_cross_room': return 'cross_room';
    case 'archive_protected_fields': return 'database_migration';
    case 'archive_unknown':
    default:
      return 'unknown';
  }
}

export function Dashboard() {
  const navigate = useNavigate();
    const reduceMotion = useReducedMotion();
  // Immersive entrance only on the first dashboard view of the session. Read in
  // the initializer (pure), mark as seen in an effect (StrictMode-safe).
  const [immersiveEntrance] = useState(() => {
    try {
      return !sessionStorage.getItem(DASHBOARD_IMMERSIVE_SESSION_KEY);
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(DASHBOARD_IMMERSIVE_SESSION_KEY, '1');
    } catch {
      // sessionStorage unavailable — entrance just won't be marked seen.
    }
  }, []);
  const { user, profile } = useAuth();
  const migration = useMigrationState(user?.id);
  const { activeRoom, activeRoomId } = useRoom();
  const data = useSharedData();
  const { refreshAll, isRefreshing } = data;
  const {
    quickAmounts,
    markBucketDragHintSeen,
  } = data.profile;
  const {
    personalGoalTarget,
    loading: goalLoading,
    error: goalError,
  } = data.goal;
  const { updateMemberCover } = useRooms();
  // Hero cover is per-user (room_members.cover_image_url), falling back to the
  // shared room cover when the member has not set their own.
  const heroCoverUrl = activeRoom?.member_cover_image_url ?? activeRoom?.cover_image_url ?? null;
  // Adaptive tint applies only to the member's own cover; the shared
  // fallback cover (and legacy covers) use the neutral scrim.
  const heroCoverTint = activeRoom?.member_cover_image_url ? (activeRoom?.member_cover_tint ?? null) : null;
  const { logIntentEvent } = useBucketIntentSettings(activeRoomId);
  const { buckets, loading: bucketsLoading, saveBuckets, reviewBucketCategories, refetch: refetchBuckets } = data.buckets;
  const { transfers: bucketTransfers, upsertTransfer } = data.bucketTransfers;
  const { allocations: balanceAllocations, refetch: refetchAllocations } = data.balanceAllocations;
  const { logs, loading: logsLoading, error: logsError, insert } = data.logs;
  const { total } = useSavingsTotal(user?.id, logs);
  const leaderboard = data.leaderboard;
  const {
    latest: latestCheckpoint,
    unallocatedPool,
    overAllocated,
    allocationSum,
    allocate,
    loading: reconcileLoading,
  } = data.reconcile;
  // Option A (plan 56 slice 4a): the hero number equals the sum of the
  // user's bucket cards (Recorded Deposits + signed allocations), so hero =
  // buckets = Verified Balance right after a check — never three competing
  // totals. Recorded Deposits stays inside the Saving Plan card only.
  const heroSaved = total + allocationSum;
  const {
    frozenDates: streakFrozenDates,
  } = data.streakFreeze;
  const { count: unreadNotifications } = useUnreadNotificationsCount();
  const { copy, formatMoney } = useI18n();
  const d = copy.dashboard;

  // Task 32 plural fields — N-safe other-member data.
  const { memberIds: otherMemberIds } = data.otherMemberIds;
  // First other member by joined_at asc — deterministic source for the
  // legacy single-partner chart props (MomentumChart, BucketSheet
  // trendPreview). At N = 2 this equals today's `partnerEntry.userId`.
  const firstOtherMemberByJoinedAt = otherMemberIds[0] ?? null;
  const firstOtherEntry = firstOtherMemberByJoinedAt
    ? leaderboard.entries.find(entry => entry.userId === firstOtherMemberByJoinedAt) ?? null
    : null;
  const [expandedBucketId, setExpandedBucketId] = useState<string | null>(null);
    const smartDefault = useSmartDefaultAmount(user?.id, expandedBucketId, logs);
  const [bucketModalOpen, setBucketModalOpen] = useState(false);
  const [manageBucketsOpen, setManageBucketsOpen] = useState(false);
  const [checkBalanceOpen, setCheckBalanceOpen] = useState(false);
  const [checkBalanceMode, setCheckBalanceMode] = useState<'check' | 'sync'>('check');
  const [manageTransferSheetOpen, setManageTransferSheetOpen] = useState(false);
  const [completedBucketsOpen, setCompletedBucketsOpen] = useState(false);
  const [bucketDragMode, setBucketDragMode] = useState<BucketDragMode>('transfer');
  const [bucketReorderSaving, setBucketReorderSaving] = useState(false);
  // Optimistic reorder order (ids) so the grid reflects a drag move
  // immediately; saveBuckets refetches from the server, so without this
  // the cards would snap back until the refetch lands. Cleared once the
  // persisted order matches.
  const [optimisticActiveIds, setOptimisticActiveIds] = useState<string[] | null>(null);
  // Suppress the click that the browser fires after a drag release so it
  // doesn't leak into the deposit BucketSheet (dnd-kit pointer-up issue).
  const justDraggedRef = useRef(false);
  const dragEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editBucketId, setEditBucketId] = useState<string | null>(null);
  const { archive, pending: removePending } = useArchiveBucket();
  const [pendingRemove, setPendingRemove] = useState<Bucket | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingBucketId, setRemovingBucketId] = useState<string | null>(null);
  const [migrationBannerDismissed, setMigrationBannerDismissed] = useState(false);
  const [transferIntent, setTransferIntent] = useState<{
    sourceId: string;
    destinationId: string | null;
    initialAmount?: number | null;
    suggestionReason?: string | null;
  } | null>(null);
  // Allocation intent: opens the AllocateSheet. `bucketId` is the drop
  // target (null when opened via the tap fallback → pick a bucket).
  const [allocationIntent, setAllocationIntent] = useState<{ bucketId: string | null } | null>(null);
  // Bumped on each open so the AllocateSheet remounts with fresh defaults.
  const [allocationKey, setAllocationKey] = useState(0);
  // Local "dismissed this render" flag so the hint disappears
  // immediately once it auto-times-out, the user closes it, or a drag
  // starts. Account-level persistence owns the "never show again"
  // behavior across devices.
  const [bucketDragHintDismissed, setBucketDragHintDismissed] = useState(false);

  // dnd-kit sensors for the bucket transfer drag shortcut (slice 40.6).
  // Activation thresholds follow plan §12: desktop ~150ms / touch ~250ms so
  // a quick tap still opens the deposit BucketSheet and a press-and-drag
  // triggers transfer mode.
  const dragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  async function handleBucketReorderDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const sourceId = String(active.id);
    const destinationId = String(over.id);
    if (sourceId === destinationId) return;

    const activeIds = displayedActiveBucketItems.map(bucket => bucket.id);
    const sourceIndex = activeIds.indexOf(sourceId);
    const destinationIndex = activeIds.indexOf(destinationId);
    if (sourceIndex < 0 || destinationIndex < 0) return;

    const reorderedActiveIds = arrayMove(activeIds, sourceIndex, destinationIndex);
    // Reflect the new order immediately while the save + refetch happen.
    setOptimisticActiveIds(reorderedActiveIds);

    const bucketById = new Map(buckets.map(bucket => [bucket.id, bucket]));
    const activeIdSet = new Set(activeIds);
    const reorderedActiveBuckets = reorderedActiveIds
      .map(id => bucketById.get(id))
      .filter((bucket): bucket is Bucket => Boolean(bucket));
    const completedAndHiddenBuckets = buckets.filter(bucket => !activeIdSet.has(bucket.id));

    setBucketReorderSaving(true);
    const result = await saveBuckets(
      [...reorderedActiveBuckets, ...completedAndHiddenBuckets].map(bucketDraftFromExisting),
    ).finally(() => setBucketReorderSaving(false));

    if (result.error) {
      setOptimisticActiveIds(null);
      setMessage(result.code === 'duplicate_name'
        ? copy.bucket.duplicateName(result.duplicateName ?? '')
        : result.error);
      return;
    }

    setMessage(null);
    haptic('success');
  }

  function handleBucketDragEnd(event: DragEndEvent) {
    // Open a short window where the post-drag click is ignored.
    if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current);
    dragEndTimerRef.current = setTimeout(() => { justDraggedRef.current = false; }, 300);

    if (bucketDragMode === 'edit') {
      void handleBucketReorderDragEnd(event);
      return;
    }

    const { active, over } = event;
    if (!over) return;
    const sourceId = String(active.id);
    const destinationId = String(over.id);

    // Allocation drag: the unallocated-surplus chip dropped onto a bucket.
    // Opens the AllocateSheet prefilled with that bucket (plan 56 §7.2).
    if (active.data.current?.type === 'allocation' || sourceId === ALLOCATION_DRAG_ID) {
      if (bucketItems.some(b => b.id === destinationId)) {
        setAllocationKey(k => k + 1);
        setAllocationIntent({ bucketId: destinationId });
      }
      return;
    }

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
    justDraggedRef.current = true;
    if (bucketDragMode === 'edit') return;
    if (bucketDragHintDismissed) return;
    dismissBucketDragHint();
  }

  useEffect(() => () => {
    if (dragEndTimerRef.current) clearTimeout(dragEndTimerRef.current);
  }, []);

  const [bucketGoalOutcome, setBucketGoalOutcome] = useState<{ name: string; target: number } | null>(null);
  const [vaultPreview, setVaultPreview] = useState<{
    prevSaved: number;
    newSaved: number;
    target: number;
    depositAmount: number;
    bucketName: string;
    reachedBucket: boolean;
  } | null>(null);
  const [vbReminder, setVbReminder] = useState<{ open: boolean; days: number | null }>({ open: false, days: null });
  const vbReminderEvaluatedRef = useRef(false);
  const [bucketCategory, setBucketCategory] = useState<BucketCategory | null>(DEFAULT_BUCKET_CATEGORY);
  const [bucketName, setBucketName] = useState(() => copy.bucket.defaultNames[DEFAULT_BUCKET_CATEGORY]);
  const [bucketTarget, setBucketTarget] = useState('30000');
  const [message, setMessage] = useState<string | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const { uploading: coverUploading, validateRoomCoverFile, cropAndResizeRoomCover, uploadRoomCover } = useImageUpload();
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverSaving, setCoverSaving] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
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
  const bucketTargetTotal = sumTargets(buckets);
  const bucketTargetRemaining = target > 0 ? Math.max(0, target - bucketTargetTotal) : null;
  const newBucketTargetAmount = Number(bucketTarget);
  const newBucketExceedsCapacity = bucketTargetRemaining !== null
    && Number.isFinite(newBucketTargetAmount)
    && newBucketTargetAmount > bucketTargetRemaining;
  const selectedBucket = bestMicroGoalBucket(buckets, logs, bucketTransfers, d, formatMoney);
  /* eslint-disable react-hooks/preserve-manual-memoization */
  // Intent badges follow the manual (drag) order — the single source of
  // truth since reorder defines the real priority. The first active,
  // not-yet-complete bucket is the current focus; the second is next.
  const doneBucketIds = useMemo(() => {
    const set = new Set<string>();
    for (const bucket of buckets) {
      if (bucket.target_amount > 0 && bucketSaved(bucket.id, logs, bucketTransfers, balanceAllocations) >= bucket.target_amount) {
        set.add(bucket.id);
      }
    }
    return set;
  }, [buckets, logs, bucketTransfers, balanceAllocations]);
  const orderedActiveNonDoneIds = useMemo(() => {
    const inOrder = buckets
      .filter(bucket => bucket.archived_at == null && !doneBucketIds.has(bucket.id))
      .map(bucket => bucket.id);
    if (!optimisticActiveIds) return inOrder;
    const known = new Set(inOrder);
    const head = optimisticActiveIds.filter(id => known.has(id));
    const headSet = new Set(head);
    const tail = inOrder.filter(id => !headSet.has(id));
    return [...head, ...tail];
  }, [buckets, doneBucketIds, optimisticActiveIds]);
  const focusBucketId = orderedActiveNonDoneIds[0] ?? null;
  const nextBucketId = orderedActiveNonDoneIds[1] ?? null;
  const focusStates = useMemo(() => {
    const map = new Map<string, 'focus' | 'next' | 'done' | 'queued'>();
    for (const bucket of buckets) {
      if (bucket.archived_at != null) continue;
      if (doneBucketIds.has(bucket.id)) map.set(bucket.id, 'done');
      else if (bucket.id === focusBucketId) map.set(bucket.id, 'focus');
      else if (bucket.id === nextBucketId) map.set(bucket.id, 'next');
      else map.set(bucket.id, 'queued');
    }
    return map;
  }, [buckets, doneBucketIds, focusBucketId, nextBucketId]);
  const bucketItems = useMemo(() => {
    const statusLabels = copy.bucketIntent.status;
    return buckets.map(bucket => {
      const saved = bucketSaved(bucket.id, logs, bucketTransfers, balanceAllocations);
      const focusState = focusStates.get(bucket.id);
      let status: { kind: 'focus' | 'next' | 'done' | 'queued' | 'overdue'; label: string } | undefined;
      if (focusState) {
        const label = statusLabels[focusState] ?? '';
        status = { kind: focusState, label };
      }
      const paceResult = bucket.deadline
        ? calcBucketPace(bucket, logs, undefined, bucketTransfers, balanceAllocations)
        : null;
      return {
        id: bucket.id,
        icon: bucketIcon(bucket.category),
        name: bucket.name,
        saved,
        target: bucket.target_amount,
        category: bucket.category,
        deadline: bucket.deadline,
        completedAt: bucket.completed_at,
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
  }, [buckets, logs, bucketTransfers, balanceAllocations, focusStates, copy.bucketIntent.status]);
  const activeBucketItems = useMemo(() => bucketItems.filter(b => b.status?.kind !== 'done'), [bucketItems]);
  const completedBucketItems = useMemo(() => bucketItems.filter(b => b.status?.kind === 'done'), [bucketItems]);
  const manualActiveBucketItems = useMemo(() => {
    const itemById = new Map(bucketItems.map(item => [item.id, item]));
    return buckets
      .map(bucket => itemById.get(bucket.id))
      .filter((item): item is (typeof bucketItems)[number] => item != null && item.status?.kind !== 'done');
  }, [buckets, bucketItems]);
  // Manual drag order is the single source of truth for display in both
  // transfer and reorder modes. Intent badges (focus/next/done) stay as
  // visual-only labels and no longer drive sort order.
  const displayedActiveBucketItems = optimisticActiveIds
    ? (() => {
        const byId = new Map(manualActiveBucketItems.map(b => [b.id, b]));
        const ordered = optimisticActiveIds
          .map(id => byId.get(id))
          .filter((b): b is (typeof manualActiveBucketItems)[number] => Boolean(b));
        const seen = new Set(optimisticActiveIds);
        for (const b of manualActiveBucketItems) if (!seen.has(b.id)) ordered.push(b);
        return ordered;
      })()
    : manualActiveBucketItems;
  // Drop the optimistic order once the refetched buckets reflect it.
  useEffect(() => {
    if (!optimisticActiveIds) return;
    const current = manualActiveBucketItems.map(b => b.id);
    if (current.length === optimisticActiveIds.length
        && current.every((id, i) => id === optimisticActiveIds[i])) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptimisticActiveIds(null);
    }
  }, [manualActiveBucketItems, optimisticActiveIds]);
  const actionAlertBuckets = useMemo<ActionAlertBucket[]>(() => buckets
    .filter(bucket => !doneBucketIds.has(bucket.id) && bucket.deadline)
    .map(bucket => {
      const pace = calcBucketPace(bucket, logs, undefined, bucketTransfers, balanceAllocations);
      if (pace.status !== 'behind' && pace.status !== 'critical') return null;
      return {
        id: bucket.id,
        name: bucket.name,
        status: pace.status,
        remainingAmount: pace.remainingAmount,
        remainingDays: pace.remainingDays,
        requiredPerDay: pace.requiredPerDay,
      };
    })
    .filter((bucket): bucket is ActionAlertBucket => bucket !== null)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'critical' ? -1 : 1;
      return (b.requiredPerDay ?? 0) - (a.requiredPerDay ?? 0);
    }), [buckets, doneBucketIds, logs, bucketTransfers, balanceAllocations]);
  const actionAlertStorageKey = useMemo(() => {
    const signature = actionAlertBuckets.map(bucket => `${bucket.id}:${bucket.status}`).join('|') || 'none';
    return `dashboard-action-alert:${activeRoomId ?? 'no-room'}:${user?.id ?? 'anon'}:${signature}`;
  }, [actionAlertBuckets, activeRoomId, user?.id]);
  /* eslint-enable react-hooks/preserve-manual-memoization */
  const todayKey = todayBangkokKey();
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
  // Habit / streak is derived entirely from per-bucket plans (deadline +
  // saving rule). The legacy room-level Saving Plan no longer feeds the
  // dashboard.
  const displayedHabitStatus = {
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
  };
  const heroStreak = displayedHabitStatus.streak ?? 0;
  const heroStreakUnit = bucketStreak.unit;

  const youName = you?.displayName ?? profile?.display_name ?? d.youLabel;

  function handleBucketCategoryChange(next: BucketCategory) {
    setBucketCategory(next);
    setBucketName(currentName =>
      shouldAutofillBucketName(currentName, copy.bucket.defaultNames)
        ? copy.bucket.defaultNames[next]
        : currentName,
    );
  }

  const handleActionAlertView = useCallback((bucketId: string) => {
    setExpandedBucketId(bucketId);
    haptic('success');
  }, []);

  const handleCheckBalance = useCallback(() => {
    setCheckBalanceMode('check');
    setCheckBalanceOpen(true);
  }, []);
  const handleSyncShortfall = useCallback(() => {
    setCheckBalanceMode('sync');
    setCheckBalanceOpen(true);
  }, []);
  const handleOpenManageBuckets = useCallback(() => {
    if (buckets.length > 0) {
      setManageBucketsOpen(true);
    } else {
      setBucketModalOpen(true);
    }
  }, [buckets.length]);
  function handleHeroCoverChoose() {
    if (!activeRoomId || coverSaving || coverUploading) return;
    setCoverError(null);
    setCoverPickerOpen(true);
  }

  function handleHeroCoverUploadOwn() {
    setCoverPickerOpen(false);
    setCoverError(null);
    coverFileInputRef.current?.click();
  }

  async function handleHeroCoverSelectPreset(preset: HeroCoverPreset) {
    if (!activeRoomId || coverSaving || coverUploading) return;
    setCoverSaving(true);
    setCoverError(null);
    try {
      const updateResult = await updateMemberCover(activeRoomId, {
        cover_image_url: preset.url,
        cover_tint: preset.tint,
      });
      if (updateResult.error) {
        setCoverError(updateResult.error);
        return;
      }
      setCoverPickerOpen(false);
      haptic('success');
    } finally {
      setCoverSaving(false);
    }
  }

  function handleHeroCoverFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    if (!file) return;

    const validationError = validateRoomCoverFile(file);
    if (validationError) {
      setCoverError(roomCoverErrorMessage(validationError, copy.createRoomWizard));
      return;
    }

    setCoverError(null);
    setCoverCropFile(file);
  }

  async function handleHeroCoverApplyCrop(crop: CropRect) {
    if (!coverCropFile || !activeRoomId) return;

    setCoverSaving(true);
    setCoverError(null);
    try {
      const { blob, tint } = await cropAndResizeRoomCover(coverCropFile, crop);
      const result = await uploadRoomCover(blob);
      if (result.errorCode || result.error || !result.url) {
        setCoverError(roomCoverErrorMessage(result.errorCode ?? 'upload_failed', copy.createRoomWizard, result.error));
        return;
      }

      const updateResult = await updateMemberCover(activeRoomId, { cover_image_url: result.url, cover_tint: tint });
      if (updateResult.error) {
        setCoverError(updateResult.error);
        return;
      }

      setCoverCropFile(null);
      haptic('success');
    } catch (error) {
      setCoverError(roomCoverErrorMessage(
        error instanceof Error && error.message === 'canvas_failed' ? 'canvas_failed' : 'decode_failed',
        copy.createRoomWizard,
      ));
    } finally {
      setCoverSaving(false);
    }
  }

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

  function openRemoveBucket(bucket: Bucket) {
    setRemoveError(null);
    setPendingRemove(bucket);
  }

  function closeRemoveBucket() {
    if (removePending) return;
    setPendingRemove(null);
    setRemoveError(null);
  }

  async function handleArchiveBucket() {
    if (!pendingRemove) return;
    setRemoveError(null);
    const result = await archive({ bucketId: pendingRemove.id });
    if (result.error) {
      // Safety net: the bucket gained a balance between opening the modal
      // and confirming. Route into the transfer sheet instead of failing.
      if (result.error.hint === 'archive_nonzero_balance' && buckets.some(b => b.id !== pendingRemove.id)) {
        const sourceId = pendingRemove.id;
        setPendingRemove(null);
        setTransferIntent({ sourceId, destinationId: null });
        return;
      }
      setRemoveError(copy.bucketRemove.errors[mapArchiveHintToErrorKey(result.error.hint)]);
      return;
    }
    const removedId = pendingRemove.id;
    setPendingRemove(null);
    haptic('success');
    // Play the "Gone" exit animation on the card before the refetch drops
    // it from the grid. ~420ms matches the bucket-gone keyframe.
    setRemovingBucketId(removedId);
    await new Promise(resolve => setTimeout(resolve, 420));
    await refreshAll();
    setRemovingBucketId(null);
  }

  function handleTransferBeforeRemove() {
    if (!pendingRemove) return;
    const sourceId = pendingRemove.id;
    setPendingRemove(null);
    setRemoveError(null);
    setTransferIntent({ sourceId, destinationId: null });
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

  async function handleManageBucketUpdate(bucket: Bucket, next: { name: string; target_amount: number; deadline?: string | null; saving_rule_type?: SavingRuleType | null; saving_rule_amount?: number | null; saving_rule_start_amount?: number | null; saving_rule_increment?: number | null; saving_rule_cap?: number | null; saving_rule_day_count?: number | null; reminder_day?: number | null }) {
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
            ...bucketDraftFromExisting(item),
            name: next.name,
            target_amount: next.target_amount,
            ...(next.deadline !== undefined && { deadline: next.deadline }),
            ...(next.saving_rule_type !== undefined && { saving_rule_type: next.saving_rule_type }),
            ...(next.saving_rule_amount !== undefined && { saving_rule_amount: next.saving_rule_amount }),
            ...(next.saving_rule_start_amount !== undefined && { saving_rule_start_amount: next.saving_rule_start_amount }),
            ...(next.saving_rule_increment !== undefined && { saving_rule_increment: next.saving_rule_increment }),
            ...(next.saving_rule_cap !== undefined && { saving_rule_cap: next.saving_rule_cap }),
            ...(next.saving_rule_day_count !== undefined && { saving_rule_day_count: next.saving_rule_day_count }),
            ...(next.reminder_day !== undefined && { reminder_day: next.reminder_day }),
          }
        : bucketDraftFromExisting(item)),
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

  // A bucket reorder persists via saveBuckets -> fetchBuckets, which
  // flips bucketsLoading true. The optimistic order already keeps the
  // grid correct, so don't flash the full skeleton during that save.
  if (!isRefreshing && !bucketReorderSaving && loading && shouldShowSkeleton) return <DashboardSkeleton />;
  if (!isRefreshing && !bucketReorderSaving && loading) return null;
  if (error) return <DashboardStatusCard title={d.errorTitle} body={error} />;

  const dashboardContainerVariants = reduceMotion
    ? reducedContainerVariants
    : immersiveEntrance
      ? immersiveContainerVariants
      : containerVariants;
  const dashboardSectionVariants = reduceMotion
    ? reducedSectionVariants
    : immersiveEntrance
      ? immersiveSectionVariants
      : sectionVariants;

  return (
    <PullToRefresh onRefresh={refreshAll}>
      {createPortal(
        <div aria-hidden className="dashboard-mesh-bg pointer-events-none fixed inset-0 -z-10" />,
        document.body,
      )}
    <motion.div className="flex flex-col gap-6 pt-8 pb-6" variants={dashboardContainerVariants} initial="hidden" animate="visible">
      {/* Project header. Compact, no heavy card. */}
      <motion.header
        className="flex items-start justify-between gap-3"
        variants={dashboardSectionVariants}
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
        <motion.div variants={dashboardSectionVariants} className="rounded-xl bg-surface p-4 shadow-soft">
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

      <motion.div variants={dashboardSectionVariants} className="min-h-[14rem]">
        <HeroCard
          displayName={youName}
          saved={heroSaved}
          target={target}
          roomName={activeRoom?.name ?? null}
          roomCategory={activeRoom?.category ?? null}
          coverImageUrl={heroCoverUrl}
          validThru={activeRoom?.end_date ?? null}
          dailySummaryItem={bucketSummaryItems[0] ?? null}
          hasBuckets={buckets.length > 0}
          bucketCount={buckets.filter(bucket => bucket.archived_at == null).length}
          streak={heroStreak}
          streakUnit={heroStreakUnit}
          streakTrackable={bucketStreak.trackable}
          lastCheckedAt={latestCheckpoint?.checked_at ?? null}
          onEdit={handleOpenManageBuckets}
          editAriaLabel="แก้ไขเป้าหมาย"
          onChangeCover={handleHeroCoverChoose}
          changeCoverAriaLabel={`${copy.createRoomWizard.changeCoverButton} ${copy.createRoomWizard.coverImagePlaceholder}`}
          changingCover={coverSaving || coverUploading}
          coverTint={heroCoverTint}
        />
        <input
          ref={coverFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleHeroCoverFileChange}
        />
        {coverError && !coverCropFile && (
          <p className="mt-3 rounded-lg bg-danger-soft px-4 py-2 font-mono text-sm text-danger">
            {coverError}
          </p>
        )}
      </motion.div>


      {actionAlertBuckets.length > 0 && (
        <motion.div variants={dashboardSectionVariants}>
          <ActionAlert
            buckets={actionAlertBuckets}
            storageKey={actionAlertStorageKey}
            formatMoney={formatMoney}
            onViewBucket={handleActionAlertView}
          />
        </motion.div>
      )}

      {/* (Next Win — hidden for now; component preserved.) */}
      {SHOW_NEXT_WIN && (
        <motion.div variants={dashboardSectionVariants}>
          <MicroGoalCard {...selectedBucket} />
        </motion.div>
      )}

      {/* 4 — Smart Buckets. */}
      <motion.div className="flex min-h-[18rem] flex-col gap-3" variants={dashboardSectionVariants}>
          <DndContext
            sensors={dragSensors}
            collisionDetection={bucketDragMode === 'edit' ? closestCenter : undefined}
            modifiers={bucketDragMode === 'edit' ? undefined : bucketDragModifiers}
            onDragStart={handleBucketDragStart}
            onDragEnd={handleBucketDragEnd}
          >
            {(() => {
              const isEditing = bucketDragMode === 'edit';
              const editToggle = activeBucketItems.length >= 1 ? (
                <button
                  type="button"
                  disabled={bucketReorderSaving}
                  aria-pressed={isEditing}
                  onClick={() => setBucketDragMode(prev => prev === 'edit' ? 'transfer' : 'edit')}
                  className={
                    'inline-flex h-8 w-fit shrink-0 items-center gap-1.5 rounded-pill px-3 font-mono text-[11px] font-bold transition-colors '
                    + (bucketReorderSaving ? 'cursor-wait opacity-60 ' : '')
                    + (isEditing
                      ? 'bg-brand-500 text-ink-inverse shadow-haloOrange'
                      : 'bg-well text-ink-muted shadow-neuPressed hover:text-ink')
                  }
                >
                  <IconEdit size={13} />
                  <span>{isEditing ? copy.bucketDragMode.doneButton : copy.bucketDragMode.editButton}</span>
                </button>
              ) : null;

              const grid = (
                <BucketGrid
                  title={d.tripBuckets}
                  subtitle={buckets.length > 0 ? d.bucketCount(displayedActiveBucketItems.length) : undefined}
                  buckets={displayedActiveBucketItems}
                  ctaLabel={buckets.length > 0 ? d.addBucket : d.createBucket}
                  addShortLabel={d.addShort}
                  onAddBucket={() => setBucketModalOpen(true)}
                  headerAction={editToggle}
                  belowHeader={(
                    <BalanceCheckStatus
                      latest={latestCheckpoint}
                      unallocatedPool={unallocatedPool}
                      overAllocated={overAllocated}
                      onCheck={handleCheckBalance}
                      onSync={handleSyncShortfall}
                      canAllocate={!isEditing && activeBucketItems.length > 0}
                      onAllocate={() => {
                        // Ignore the click dnd-kit fires right after a drag
                        // so a drop doesn't also pop the bucket picker.
                        if (justDraggedRef.current) return;
                        setAllocationKey(k => k + 1);
                        setAllocationIntent({ bucketId: null });
                      }}
                    />
                  )}
                  renderBucket={bucket => isEditing ? (
                    <SortableBucketCard
                      id={bucket.id}
                      onRemove={() => {
                        const target = buckets.find(b => b.id === bucket.id);
                        if (target) openRemoveBucket(target);
                      }}
                      removeAriaLabel={copy.bucket.deleteAriaLabel(bucket.name)}
                      onCardClick={() => {
                        if (justDraggedRef.current) return;
                        setEditBucketId(bucket.id);
                      }}
                      removing={removingBucketId === bucket.id}
                      hideRemoveButton={pendingRemove?.id === bucket.id}
                    >
                      <BucketRow
                        icon={bucket.icon}
                        name={bucket.name}
                        saved={bucket.saved}
                        target={bucket.target}
                        category={bucket.category}
                        status={bucket.status}
                        deadline={bucket.deadline}
                        pace={bucket.pace}
                      />
                    </SortableBucketCard>
                  ) : (
                    <BucketDragCard id={bucket.id}>
                      <BucketRow
                        icon={bucket.icon}
                        name={bucket.name}
                        saved={bucket.saved}
                        target={bucket.target}
                        category={bucket.category}
                        status={bucket.status}
                        deadline={bucket.deadline}
                        pace={bucket.pace}
                        onClick={() => {
                          if (justDraggedRef.current) return;
                          setExpandedBucketId(bucket.id);
                        }}
                      />
                    </BucketDragCard>
                  )}
                />
              );

              return isEditing ? (
                <SortableContext
                  items={displayedActiveBucketItems.map(b => b.id)}
                  strategy={rectSortingStrategy}
                >
                  {grid}
                </SortableContext>
              ) : grid;
            })()}
          </DndContext>
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
              <span className={`text-2xl leading-none text-ink-dim transition-transform duration-300 ${completedBucketsOpen ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>
            <AnimatePresence initial={false}>
              {completedBucketsOpen && (
                <motion.div
                  key="completed-buckets"
                  initial={reduceMotion ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduceMotion ? { height: 'auto', opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.34, ease: [0.16, 1, 0.2, 1] }}
                  className="overflow-hidden"
                >
              <div className="grid grid-cols-2 gap-4 p-1">
                {completedBucketItems.map(bucket => {
                  const isEditing = bucketDragMode === 'edit';
                  const removing = removingBucketId === bucket.id;
                  const row = (
                    <BucketRow
                      icon={bucket.icon}
                      name={bucket.name}
                      saved={bucket.saved}
                      target={bucket.target}
                      category={bucket.category}
                      status={bucket.status}
                      completedAt={bucket.completedAt}
                      variant="completed"
                      onClick={isEditing ? undefined : () => setExpandedBucketId(bucket.id)}
                    />
                  );
                  if (!isEditing) return <div key={bucket.id}>{row}</div>;
                  return (
                    <div key={bucket.id} className="relative rounded-2xl">
                      <div
                        className={removing ? 'bucket-gone' : ''}
                        onClick={removing ? undefined : () => setEditBucketId(bucket.id)}
                      >
                        {row}
                      </div>
                      {!removing && pendingRemove?.id !== bucket.id && (
                        <IconButton
                          type="button"
                          variant="solid"
                          size="sm"
                          ariaLabel={copy.bucket.deleteAriaLabel(bucket.name)}
                          className="absolute right-2 top-2 z-10 !bg-white !text-danger shadow-soft ring-1 ring-danger/10 hover:!bg-danger-soft hover:!text-danger"
                          onClick={() => {
                            const target = buckets.find(b => b.id === bucket.id);
                            if (target) openRemoveBucket(target);
                          }}
                        >
                          <IconX size={16} strokeWidth={2.75} />
                        </IconButton>
                      )}
                    </div>
                  );
                })}
              </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {buckets.length === 0 && (
          <Button variant="action" fullWidth onClick={() => setBucketModalOpen(true)}>
            {d.createFirstBucket}
          </Button>
        )}
        {message && <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>}
      </motion.div>

      {/* 5 — My saving streak (me-only contributions heatmap). */}
      <motion.div variants={dashboardSectionVariants}>
        <SavingsHeatmap
          logs={logs}
          userId={user?.id}
          buckets={buckets}
          transfers={bucketTransfers}
          roomStartIso={activeRoom?.created_at ?? null}
          roomEndDateKey={activeRoom?.end_date ?? null}
          storageKey={`savings-heatmap-scroll:${activeRoomId ?? 'no-room'}:${user?.id ?? 'anon'}`}
        />
      </motion.div>

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

      <HeroCoverPicker
        open={coverPickerOpen}
        onClose={() => { if (!coverSaving) setCoverPickerOpen(false); }}
        onSelectPreset={handleHeroCoverSelectPreset}
        onUploadOwn={handleHeroCoverUploadOwn}
        saving={coverSaving || coverUploading}
        selectedUrl={heroCoverUrl}
      />

      {coverCropFile && (
        <ImageCropper
          open
          file={coverCropFile}
          saving={coverSaving || coverUploading}
          error={coverError}
          onCancel={() => {
            if (coverSaving || coverUploading) return;
            setCoverCropFile(null);
            setCoverError(null);
          }}
          onApply={handleHeroCoverApplyCrop}
        />
      )}

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
        onClose={() => setManageBucketsOpen(false)}
        hidden={manageTransferSheetOpen}
      >
        <BucketManager
          buckets={buckets}
          logs={logs}
          transfers={bucketTransfers}
          goalTarget={target > 0 ? target : null}
          roomEndDate={activeRoom?.end_date ?? null}
          onUpdate={handleManageBucketUpdate}
          onReviewCategories={async (updates) => {
            const result = await reviewBucketCategories(updates);
            if (!result.error) {
              for (const u of updates) {
                void logIntentEvent({
                  eventKey: 'category_reviewed',
                  bucketId: u.id,
                  payload: { category: u.category },
                });
              }
            }
            return result;
          }}
          onTransferSheetOpenChange={setManageTransferSheetOpen}
          onRemoved={refetchBuckets}
        />
      </Modal>

      {(() => {
        const editBucket = editBucketId ? buckets.find(b => b.id === editBucketId) : null;
        return (
          <Modal
            open={Boolean(editBucket)}
            title={copy.bucket.editAriaLabel(editBucket?.name ?? '')}
            onClose={() => setEditBucketId(null)}
          >
            {editBucket && (
              <BucketEditForm
                bucket={editBucket}
                buckets={buckets}
                logs={logs}
                transfers={bucketTransfers}
                goalTarget={target > 0 ? target : null}
                roomEndDate={activeRoom?.end_date ?? null}
                autoScrollOnExpand
                onCancel={() => setEditBucketId(null)}
                onSave={handleManageBucketUpdate}
                onSaved={() => setEditBucketId(null)}
              />
            )}
          </Modal>
        );
      })()}

      {(() => {
        const savedAmount = pendingRemove
          ? bucketSaved(pendingRemove.id, logs, bucketTransfers, balanceAllocations)
          : 0;
        const destinations: RemoveBucketDestination[] = pendingRemove
          ? buckets
              .filter(b => b.id !== pendingRemove.id)
              .map(b => ({
                id: b.id,
                name: b.name,
                saved: bucketSaved(b.id, logs, bucketTransfers, balanceAllocations),
              }))
          : [];
        return (
          <RemoveBucketModal
            open={pendingRemove !== null}
            bucketName={pendingRemove?.name ?? null}
            savedAmount={savedAmount}
            destinations={destinations}
            pending={removePending}
            errorMessage={removeError}
            onClose={closeRemoveBucket}
            onArchive={handleArchiveBucket}
            onTransferFirst={handleTransferBeforeRemove}
          />
        );
      })()}

      <VerifiedBalanceReminderModal
        open={vbReminder.open}
        daysSinceLast={vbReminder.days}
        onClose={closeVbReminder}
        onCheckNow={() => {
          closeVbReminder();
          setCheckBalanceMode('check');
          setCheckBalanceOpen(true);
        }}
      />

      <CheckBalanceSheet
        open={checkBalanceOpen}
        onClose={() => setCheckBalanceOpen(false)}
        initialMode={checkBalanceMode}
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

      {/* Allocate unallocated reconcile surplus into a bucket (plan 56). */}
      <AllocateSheet
        key={`allocate-${allocationKey}`}
        open={allocationIntent !== null}
        onClose={() => setAllocationIntent(null)}
        pool={unallocatedPool}
        buckets={bucketItems}
        initialBucketId={allocationIntent?.bucketId ?? null}
        allocate={allocate}
        onAllocated={() => { void refetchAllocations(); }}
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
          quickAmounts={quickAmounts}
            open={Boolean(expandedBucketId)}
            onClose={() => setExpandedBucketId(null)}
            bucketId={expandedBucketId ?? ''}
            icon={selectedBucketItem?.icon ?? null}
            name={selectedBucketItem?.name ?? ''}
            saved={selectedBucketItem?.saved ?? 0}
            target={selectedBucketItem?.target ?? 0}
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
                    prevSaved: heroSaved,
                    newSaved: heroSaved + amount,
                    target,
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
        displayName={youName}
        roomName={activeRoom?.name ?? null}
        roomCategory={activeRoom?.category ?? null}
        coverImageUrl={heroCoverUrl}
        validThru={activeRoom?.end_date ?? null}
        dailySummaryItem={bucketSummaryItems[0] ?? null}
        hasBuckets={buckets.length > 0}
        bucketCount={buckets.filter(bucket => bucket.archived_at == null).length}
        streak={heroStreak}
        streakUnit={heroStreakUnit}
        streakTrackable={bucketStreak.trackable}
        lastCheckedAt={latestCheckpoint?.checked_at ?? null}
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
        <Button variant="action" fullWidth size="md" onClick={() => setBucketGoalOutcome(null)}>
          {copy.addMoney.outcomeDone}
        </Button>
      </OutcomeModal>
    </motion.div>
    </PullToRefresh>
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
    <div className="flex flex-col gap-6 pt-8 pb-6 animate-fade-in" aria-busy="true" aria-label={copy.common.loadingDashboard}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-8 w-52 max-w-[70%]" />
          <Skeleton className="mt-2 h-3 w-12 rounded-pill" />
        </div>
        <Spinner size="sm" tone="neutral" />
      </div>
      <HeroCardSkeleton />
      <Skeleton className="h-16 rounded-xl" />
      <BucketZoneSkeleton />
      <HeatmapSkeleton />
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <section className="rounded-xl bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-28 rounded-pill" />
      </div>
      <Skeleton className="mt-4 h-[120px] rounded-lg" />
    </section>
  );
}

function HeroCardSkeleton() {
  return (
    <section className="flex aspect-[1.52/1] min-h-[15rem] flex-col rounded-3xl bg-brand-50 px-5 py-4 shadow-soft min-[480px]:px-6 min-[480px]:py-5">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-6 w-36 rounded-pill bg-white/50" />
        <Skeleton className="h-6 w-16 rounded-pill bg-white/45" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-10 w-56 max-w-full bg-white/55" />
        <Skeleton className="mt-3 h-2 w-[66%] rounded-pill bg-white/45" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full rounded-pill bg-white/45" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/45 pt-3">
        <Skeleton className="h-9 rounded-xl bg-white/35" />
        <Skeleton className="h-9 rounded-xl bg-white/35" />
      </div>
      <div className="mt-auto grid grid-cols-4 gap-2 border-t border-white/45 pt-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-8 rounded-xl bg-white/35" />
        ))}
      </div>
    </section>
  );
}

function BucketZoneSkeleton() {
  return (
    <section className="flex min-h-[18rem] flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="mt-2 h-3 w-24 rounded-pill" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 p-1">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </section>
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
