import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BucketManager } from '../components/BucketManager/BucketManager';
import { Button } from '../components/Button/Button';
import { ConfirmModal } from '../components/ConfirmModal/ConfirmModal';
import { FormField } from '../components/FormField/FormField';
import {
  IconArrowLeft,
  IconBed,
  IconBriefcase,
  IconCalendar,
  IconFork,
  IconGear,
  IconHome,
  IconPiggyBank,
  IconPlane,
  IconQrCode,
  IconSmartphone,
  IconTicket,
  IconTrash,
  IconUserPlus,
} from '../components/Icon/Icon';
import { Modal } from '../components/Modal/Modal';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { QuickAmountsEditor } from '../components/QuickAmountsEditor/QuickAmountsEditor';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { SettingsList } from '../components/SettingsList/SettingsList';
import { TextInput } from '../components/TextInput/TextInput';
import { useAuth } from '../hooks/useAuth';
import { useBuckets } from '../hooks/useBuckets';
import { useGoal } from '../hooks/useGoal';
import { useI18n } from '../i18n/useI18n';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useLogs } from '../hooks/useLogs';
import { usePartnerBuckets } from '../hooks/usePartnerBuckets';
import { useProfile } from '../hooks/useProfile';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import { sumTargets } from '../lib/buckets';
import { haptic } from '../lib/haptics';
import type { Bucket, BucketCategory } from '../types';

type ManageModal = 'trip-goal' | 'invite-code' | 'quick-amounts' | 'buckets' | null;

const BUCKET_OPTION_ICONS: { id: BucketCategory; icon: ReactNode }[] = [
  { id: 'flight', icon: <IconPlane size={22} /> },
  { id: 'accom', icon: <IconBed size={22} /> },
  { id: 'dining', icon: <IconFork size={22} /> },
  { id: 'activities', icon: <IconTicket size={22} /> },
  { id: 'gear', icon: <IconSmartphone size={22} /> },
  { id: 'home', icon: <IconHome size={22} /> },
  { id: 'other', icon: <IconBriefcase size={22} /> },
];

export function ManageProject() {
  const navigate = useNavigate();
  const { copy, formatMoney } = useI18n();
  const { user } = useAuth();
  const { activeRoom, activeRoomId } = useRoom();
  const { goal, saveRoomGoal } = useGoal(activeRoomId);
  const { archiveRoom, leaveRoom, refetch: refetchRooms } = useRooms();
  const { quickAmounts, updateQuickAmounts } = useProfile();
  const { buckets, saveBuckets } = useBuckets(activeRoomId);
  const { logs } = useLogs(100, activeRoomId);
  const leaderboard = useLeaderboard(logs, user?.id, activeRoomId);
  const partnerEntry = leaderboard.entries.find(entry => !entry.isYou);
  const { buckets: partnerBuckets } = usePartnerBuckets(activeRoomId, partnerEntry?.userId);
  const [activeModal, setActiveModal] = useState<ManageModal>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tripDateDraft, setTripDateDraft] = useState(activeRoom?.end_date ?? '');
  const [targetAmountDraft, setTargetAmountDraft] = useState(goal?.target_amount ? String(goal.target_amount) : '');
  const [quickAmountDrafts, setQuickAmountDrafts] = useState<string[]>(quickAmounts.map(String));
  const [bucketCategory, setBucketCategory] = useState<BucketCategory | null>('flight');
  const [bucketName, setBucketName] = useState('Flights');
  const [bucketTarget, setBucketTarget] = useState('30000');

  const bucketOptions = BUCKET_OPTION_ICONS.map(({ id, icon }) => ({
    id, icon, label: copy.bucket.categoryLabels[id],
  }));

  if (!activeRoom) {
    return (
      <section className="rounded-xl bg-surface p-5 shadow-soft">
        <SectionLabel tone="brand">{copy.manageProject.noProjectLabel}</SectionLabel>
        <p className="mt-2 font-mono text-xs text-ink-muted">{copy.manageProject.noProjectBody}</p>
      </section>
    );
  }

  const isCreator = activeRoom.created_by === user?.id;
  const goalTarget = goal?.target_amount ?? null;
  const yourBucketTargetTotal = sumTargets(buckets);
  const partnerBucketTargetTotal = sumTargets(partnerBuckets);
  const highestMemberBucketTargetTotal = Math.max(yourBucketTargetTotal, partnerBucketTargetTotal);
  const goalDraftAmount = Number(targetAmountDraft);
  const effectiveGoalDraftAmount = Number.isFinite(goalDraftAmount) && goalDraftAmount > 0
    ? goalDraftAmount
    : goalTarget ?? 0;
  const goalDraftTooLow = Number.isFinite(goalDraftAmount)
    && goalDraftAmount > 0
    && goalDraftAmount < highestMemberBucketTargetTotal;

  function openModal(next: ManageModal) {
    if (next === 'trip-goal') {
      setTripDateDraft(activeRoom?.end_date ?? '');
      setTargetAmountDraft(goal?.target_amount ? String(goal.target_amount) : '');
    }
    if (next === 'quick-amounts') setQuickAmountDrafts(quickAmounts.map(String));
    setActiveModal(next);
    setMessage(null);
  }

  function closeModal() {
    setActiveModal(null);
    setMessage(null);
  }

  async function handleTripGoalSave() {
    if (!activeRoomId || !tripDateDraft) {
      setMessage(copy.manageProject.tripGoalValidationDate);
      return;
    }
    const target = Number(targetAmountDraft);
    if (!Number.isFinite(target) || target <= 0) {
      setMessage(copy.manageProject.tripGoalValidationAmount);
      return;
    }
    if (target < highestMemberBucketTargetTotal) {
      setMessage(copy.manageProject.tripGoalValidationMin(formatMoney(highestMemberBucketTargetTotal)));
      return;
    }
    const goalResult = await saveRoomGoal({
      target_amount: target,
      end_date: tripDateDraft,
    });
    if (goalResult.error) { setMessage(goalResult.error); return; }
    await refetchRooms();
    setMessage(copy.manageProject.tripGoalSuccess);
    closeModal();
  }

  async function handleQuickAmountsSave() {
    const result = await updateQuickAmounts(quickAmountDrafts.map(Number));
    if (result.error) setMessage(result.error);
    else {
      setMessage(copy.manageProject.quickAmountsSuccess);
      closeModal();
    }
  }

  async function handleCreateBucket() {
    const target = Number(bucketTarget);
    if (!bucketCategory || !bucketName.trim() || target <= 0) {
      setMessage(copy.bucket.validationNameAndTarget);
      return;
    }
    if (goalTarget !== null && yourBucketTargetTotal + target > goalTarget) {
      setMessage(copy.bucket.capacityError(formatMoney(Math.max(0, goalTarget - yourBucketTargetTotal))));
      return;
    }
    const result = await saveBuckets([
      ...buckets,
      { id: undefined, name: bucketName.trim(), target_amount: target, category: bucketCategory },
    ]);
    if (result.error) setMessage(result.error);
    else {
      haptic('success');
      setMessage(copy.bucket.createdSuccess);
      setBucketName('');
      setBucketTarget('');
    }
  }

  async function handleUpdateBucket(bucket: Bucket, next: { name: string; target_amount: number }) {
    if (goalTarget !== null) {
      const capacityForBucket = goalTarget - (yourBucketTargetTotal - bucket.target_amount);
      if (next.target_amount > capacityForBucket) {
        const error = copy.bucket.capacityErrorForEdit(formatMoney(Math.max(0, capacityForBucket)));
        setMessage(error);
        return { error };
      }
    }

    const result = await saveBuckets(
      buckets.map(item => item.id === bucket.id
        ? { id: item.id, name: next.name, target_amount: next.target_amount, category: item.category }
        : { id: item.id, name: item.name, target_amount: item.target_amount, category: item.category }),
    );

    if (result.error) {
      setMessage(result.error);
      return result;
    }

    setMessage(copy.bucket.updatedSuccess);
    haptic('success');
    return result;
  }

  async function handleDeleteBucket(bucket: Bucket) {
    const result = await saveBuckets(
      buckets
        .filter(item => item.id !== bucket.id)
        .map(item => ({ id: item.id, name: item.name, target_amount: item.target_amount, category: item.category })),
    );

    if (result.error) {
      setMessage(result.error);
      return result;
    }

    setMessage(copy.bucket.deletedSuccess);
    return result;
  }

  async function handleArchive() {
    if (!activeRoomId) return;
    const result = await archiveRoom(activeRoomId);
    if (result.error) { setMessage(result.error); setConfirmingArchive(false); return; }
    setConfirmingArchive(false);
    navigate('/profile');
  }

  async function handleLeave() {
    if (!activeRoomId) return;
    const result = await leaveRoom(activeRoomId);
    if (result.error) { setMessage(result.error); setConfirmingLeave(false); return; }
    setConfirmingLeave(false);
    navigate('/profile');
  }

  const projectBasicsItems = [
    {
      id: 'invite',
      icon: <IconQrCode size={18} />,
      label: copy.manageProject.inviteCodeLabel,
      description: copy.manageProject.inviteCodeDesc,
      meta: <span className="copy-allowed font-mono text-xs text-brand-800">{activeRoom.invite_code}</span>,
      onClick: () => openModal('invite-code'),
    },
    {
      id: 'date',
      icon: <IconCalendar size={18} />,
      label: copy.manageProject.tripGoalLabel,
      description: activeRoom.end_date ?? 'Not set',
      meta: <span className="font-mono text-xs text-ink-muted">{goal ? formatMoney(goal.target_amount) : ''}</span>,
      onClick: isCreator ? () => openModal('trip-goal') : undefined,
    },
  ];

  const savingControlItems = [
    {
      id: 'quick',
      icon: <IconPiggyBank size={18} />,
      label: copy.manageProject.quickAmountsLabel,
      description: quickAmounts.map(formatMoney).join(' / '),
      onClick: () => openModal('quick-amounts'),
    },
    {
      id: 'buckets',
      icon: <IconGear size={18} />,
      label: copy.manageProject.manageBucketsLabel,
      description: copy.manageProject.manageBucketsDesc(buckets.length),
      onClick: () => openModal('buckets'),
    },
  ];

  const roomActionItems = [
    {
      id: 'create-another',
      icon: <IconUserPlus size={18} />,
      label: copy.manageProject.createAnotherLabel,
      description: copy.manageProject.createAnotherDesc,
      onClick: isCreator ? () => navigate('/profile?intent=create-project') : undefined,
    },
  ];

  const archiveItem = {
    id: 'archive',
    icon: <IconTrash size={18} />,
    label: isCreator ? copy.manageProject.archiveLabel : copy.manageProject.leaveLabel,
    description: isCreator ? copy.manageProject.archiveDesc : copy.manageProject.leaveDesc,
    onClick: isCreator
      ? () => setConfirmingArchive(true)
      : () => setConfirmingLeave(true),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-1 rounded-pill bg-well px-3 py-1 font-mono text-[11px] text-ink-muted shadow-neuPressed hover:text-ink"
          aria-label={`Back to ${copy.manageProject.backLabel}`}
        >
          <IconArrowLeft size={14} /> {copy.manageProject.backLabel}
        </button>
      </div>
      <PageHeader eyebrow={copy.manageProject.pageEyebrow} title={copy.manageProject.pageTitle} subtitle={activeRoom.name} />
      {message && <p className="rounded-lg bg-brand-50 px-4 py-3 font-mono text-xs text-brand-800">{message}</p>}
      <SettingsList label={copy.manageProject.sectionProjectBasics} items={projectBasicsItems} />
      <SettingsList label={copy.manageProject.sectionSavingControls} items={savingControlItems} />
      <SettingsList label={copy.manageProject.sectionRoomActions} items={roomActionItems} archiveItem={archiveItem} />
      <Modal open={activeModal === 'trip-goal'} title={copy.manageProject.tripGoalModalTitle} onClose={closeModal}>
        <div className="flex flex-col gap-4">
          <FormField label={copy.manageProject.endDateLabel}>
            <TextInput
              type="date"
              value={tripDateDraft}
              onChange={event => setTripDateDraft(event.target.value)}
            />
          </FormField>
          <GoalTargetSummary
            goalTarget={goalTarget ?? 0}
            allocated={yourBucketTargetTotal}
            partnerAllocated={partnerEntry ? partnerBucketTargetTotal : null}
          />
          <FormField
            label={copy.manageProject.targetAmountLabel}
            helper={copy.manageProject.targetAmountHelper(formatMoney(Math.max(0, effectiveGoalDraftAmount - yourBucketTargetTotal)))}
            error={goalDraftTooLow ? copy.manageProject.targetAmountError(formatMoney(highestMemberBucketTargetTotal)) : undefined}
          >
            <TextInput
              type="number"
              min={0}
              step={100}
              inputMode="decimal"
              placeholder="e.g. 80000"
              value={targetAmountDraft}
              onChange={event => setTargetAmountDraft(event.target.value)}
            />
          </FormField>
          <Button variant="primary" fullWidth onClick={handleTripGoalSave}>{copy.manageProject.saveButton}</Button>
        </div>
      </Modal>
      <Modal open={activeModal === 'invite-code'} title={copy.manageProject.inviteCodeModalTitle} onClose={closeModal}>
        <div className="flex flex-col gap-3 text-center">
          <span className="copy-allowed font-mono text-3xl font-bold tracking-[0.4em] text-brand-700">{activeRoom.invite_code}</span>
          <Button
            variant="action"
            fullWidth
            onClick={() => {
              navigator.clipboard?.writeText(activeRoom.invite_code);
              setMessage(copy.manageProject.copiedMessage);
            }}
          >
            {copy.manageProject.copyCodeButton}
          </Button>
        </div>
      </Modal>
      <Modal open={activeModal === 'quick-amounts'} title={copy.manageProject.quickAmountsModalTitle} onClose={closeModal}>
        <QuickAmountsEditor
          amounts={quickAmountDrafts}
          onChange={setQuickAmountDrafts}
          onSave={handleQuickAmountsSave}
        />
      </Modal>
      <Modal open={activeModal === 'buckets'} title={copy.manageProject.manageBucketsModalTitle} onClose={closeModal}>
        <BucketManager
          buckets={buckets}
          logs={logs}
          goalTarget={goalTarget}
          category={bucketCategory}
          options={bucketOptions}
          name={bucketName}
          target={bucketTarget}
          onCategoryChange={setBucketCategory}
          onNameChange={setBucketName}
          onTargetChange={value => setBucketTarget(value.replace(/[^0-9]/g, ''))}
          onCreate={handleCreateBucket}
          onUpdate={handleUpdateBucket}
          onDelete={handleDeleteBucket}
          statusMessage={message}
        />
      </Modal>
      <ConfirmModal
        open={confirmingArchive}
        title={copy.manageProject.archiveConfirmTitle}
        body={copy.manageProject.archiveConfirmBody}
        confirmLabel={copy.manageProject.archiveConfirmLabel}
        danger
        onCancel={() => setConfirmingArchive(false)}
        onConfirm={handleArchive}
      />
      <ConfirmModal
        open={confirmingLeave}
        title={copy.manageProject.leaveConfirmTitle}
        body={copy.manageProject.leaveConfirmBody}
        confirmLabel={copy.manageProject.leaveConfirmLabel}
        danger
        onCancel={() => setConfirmingLeave(false)}
        onConfirm={handleLeave}
      />
    </div>
  );
}

function GoalTargetSummary({
  goalTarget,
  allocated,
  partnerAllocated,
}: {
  goalTarget: number;
  allocated: number;
  partnerAllocated: number | null;
}) {
  const { copy, formatMoney } = useI18n();
  const remaining = Math.max(0, goalTarget - allocated);
  const partnerLine = partnerAllocated !== null && partnerAllocated > allocated
    ? copy.manageProject.goalSummaryPartner(formatMoney(partnerAllocated))
    : null;

  return (
    <div className="rounded-lg bg-brand-50 px-4 py-3 font-mono text-xs text-ink-muted">
      <p className="font-bold text-ink">{copy.manageProject.goalSummaryTitle(formatMoney(goalTarget))}</p>
      <p className="mt-1">{copy.manageProject.goalSummaryAllocated(formatMoney(allocated), formatMoney(goalTarget))}</p>
      <p className="mt-1">{copy.manageProject.goalSummaryRemaining(formatMoney(remaining))}</p>
      {partnerLine && <p className="mt-1 text-brand-800">{partnerLine}</p>}
    </div>
  );
}
