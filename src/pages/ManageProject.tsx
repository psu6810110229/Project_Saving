import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BucketManager } from '../components/BucketManager/BucketManager';
import { Button, MODAL_ACTION_ROW_REVERSE_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../components/Button/Button';
import { Chip } from '../components/Chip/Chip';
import { ConfirmModal } from '../components/ConfirmModal/ConfirmModal';
import { FormField } from '../components/FormField/FormField';
import { TextInput } from '../components/TextInput/TextInput';
import {
  IconArrowLeft,
  IconPiggyBank,
  IconQrCode,
  IconTrash,
  IconUserPlus,
  IconEdit,
  IconShield,
} from '../components/Icon/Icon';
import { Modal } from '../components/Modal/Modal';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { RoomMemberRow } from '../components/RoomMemberRow/RoomMemberRow';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { SettingsList } from '../components/SettingsList/SettingsList';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useRoomMembers } from '../hooks/useRoomMembers';
import { useSharedData } from '../hooks/useSharedData';
import { useI18n } from '../i18n/useI18n';
import { formatJoinedDate } from '../i18n/formatters';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import { useBucketIntentSettings } from '../hooks/useBucketIntentSettings';
import { hasDuplicateBucketName, sumTargets } from '../lib/buckets';
import { haptic } from '../lib/haptics';
import { ROOM_NAME_MAX_LENGTH } from '../lib/roomName';
import type { Bucket, SavingRuleType } from '../types';

function firstGrapheme(value: string): string {
  if (!value) return '?';
  const trimmed = value.trim();
  if (trimmed.length === 0) return '?';
  const iter = trimmed[Symbol.iterator]();
  const first = iter.next();
  if (first.done) return '?';
  return first.value.toUpperCase();
}

type ManageModal =
  | 'invite-code'
  | 'quick-amounts'
  | 'buckets'
  | 'rename-room'
  | 'room-goal'
  | 'personal-goal'
  | 'transfer-ownership'
  | null;

export function ManageProject() {
  const navigate = useNavigate();
  const { copy, formatMoney, language } = useI18n();
  const { user } = useAuth();
  const { activeRoom, activeRoomId } = useRoom();
  const {
    members,
    loading: membersLoading,
    error: membersError,
  } = useRoomMembers(activeRoomId);
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useSharedData();
  const {
    personalGoalTarget,
    roomGoalTarget,
    roomGoalEndDate,
    saveRoomGoal,
    saveMemberGoal,
  } = data.goal;
  const { archiveRoom, leaveRoom, renameRoom, transferOwnership, refetch: refetchRooms } = useRooms();
  const { logIntentEvent } = useBucketIntentSettings(activeRoomId);
  const { buckets, saveBuckets, reviewBucketCategories, refetch: refetchBuckets } = data.buckets;
  const { transfers: bucketTransfers } = data.bucketTransfers;
  const { allocations: balanceAllocations } = data.balanceAllocations;
  const { logs } = data.logs;
  const [activeModal, setActiveModal] = useState<ManageModal>(null);
  const [bucketTransferSheetOpen, setBucketTransferSheetOpen] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [roomGoalAmount, setRoomGoalAmount] = useState('');
  const [roomGoalDate, setRoomGoalDate] = useState('');
  const [roomGoalError, setRoomGoalError] = useState<string | null>(null);
  const [pendingRoomGoal, setPendingRoomGoal] = useState<{ target: number; endDate: string } | null>(null);
  const [personalGoalAmount, setPersonalGoalAmount] = useState('');
  const [personalGoalError, setPersonalGoalError] = useState<string | null>(null);
  const [selectedTransferMember, setSelectedTransferMember] = useState<string | null>(null);
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const { shouldShowLoader: shouldShowMemberSkeleton } = useLoadingGate({
    loading: membersLoading,
    showAfterMs: 120,
    minimumVisibleMs: 400,
  });

  // Dashboard's "Manage" bucket link deep-links here with ?modal=buckets.
  // Open the buckets modal and strip the param so a refresh doesn't keep
  // re-opening it. Matches the Profile page's ?intent=create-project pattern.
  useEffect(() => {
    if (searchParams.get('modal') !== 'buckets') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveModal('buckets');
    const next = new URLSearchParams(searchParams);
    next.delete('modal');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  if (!activeRoom) {
    return (
      <section className="mt-8 rounded-xl bg-surface p-5 shadow-soft">
        <SectionLabel tone="brand">{copy.manageProject.noProjectLabel}</SectionLabel>
        <p className="mt-2 font-mono text-xs text-ink-muted">{copy.manageProject.noProjectBody}</p>
      </section>
    );
  }

  const isCreator = activeRoom.created_by === user?.id;
  const goalTarget = personalGoalTarget;
  const yourBucketTargetTotal = sumTargets(buckets);

  function openModal(next: ManageModal) {
    if (next === 'rename-room') {
      if (!isCreator) return;
      setRenameDraft(activeRoom?.name ?? '');
      setRenameError(null);
    }
    if (next === 'room-goal') {
      if (!isCreator) return;
      setRoomGoalAmount(roomGoalTarget !== null ? String(roomGoalTarget) : '');
      setRoomGoalDate(roomGoalEndDate ?? activeRoom?.end_date ?? '');
      setRoomGoalError(null);
    }
    if (next === 'personal-goal') {
      setPersonalGoalAmount(personalGoalTarget !== null ? String(personalGoalTarget) : '');
      setPersonalGoalError(null);
    }
    setActiveModal(next);
    setMessage(null);
  }

  function closeModal() {
    setActiveModal(null);
    setBucketTransferSheetOpen(false);
    setMessage(null);
    setRenameError(null);
  }

  function closeBucketsModal() {
    setActiveModal(null);
    setBucketTransferSheetOpen(false);
    setMessage(null);
  }

  function mapRenameError(raw: string): string {
    const m = raw.toLowerCase();
    if (m.includes('name required')) return copy.manageProject.renameErrorEmpty;
    if (m.includes('name too long')) return copy.manageProject.renameErrorTooLong;
    if (m.includes('control character')) return copy.manageProject.renameErrorControlChars;
    if (m.includes('only the creator')) return copy.manageProject.renameErrorNotCreator;
    if (m.includes('archived')) return copy.manageProject.renameErrorArchived;
    return copy.manageProject.renameErrorGeneric;
  }

  async function handleRenameSave() {
    if (!activeRoomId || !activeRoom) return;
    const trimmed = renameDraft.trim();
    const currentTrimmed = (activeRoom.name ?? '').trim();
    if (trimmed === '') { setRenameError(copy.manageProject.renameErrorEmpty); return; }
    if (trimmed.length > ROOM_NAME_MAX_LENGTH) { setRenameError(copy.manageProject.renameErrorTooLong); return; }
    if (/[\p{Cc}]/u.test(renameDraft)) { setRenameError(copy.manageProject.renameErrorControlChars); return; }
    if (trimmed === currentTrimmed) { setRenameError(copy.manageProject.renameErrorUnchanged); return; }

    setRenaming(true);
    const result = await renameRoom(activeRoomId, trimmed);
    setRenaming(false);
    if (result.error) {
      setRenameError(mapRenameError(result.error));
      return;
    }
    haptic('success');
    setActiveModal(null);
    setRenameError(null);
    setMessage(copy.manageProject.renameSuccess);
  }

  function handleRoomGoalSubmit() {
    if (!isCreator) return;
    const amount = Number(roomGoalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRoomGoalError(copy.manageProject.tripGoalValidationAmount);
      return;
    }
    if (!roomGoalDate) {
      setRoomGoalError(copy.manageProject.tripGoalValidationDate);
      return;
    }
    setPendingRoomGoal({ target: amount, endDate: roomGoalDate });
  }

  async function confirmRoomGoalSave() {
    if (!pendingRoomGoal) return;
    const { target, endDate } = pendingRoomGoal;
    setPendingRoomGoal(null);
    const result = await saveRoomGoal({ target_amount: target, end_date: endDate });
    if (result.error) {
      setRoomGoalError(result.error);
      return;
    }
    await refetchRooms();
    setRoomGoalError(null);
    setActiveModal(null);
    setMessage(copy.manageProject.tripGoalSuccess);
  }

  async function handlePersonalGoalSubmit() {
    const amount = Number(personalGoalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPersonalGoalError(copy.manageProject.tripGoalValidationAmount);
      return;
    }
    if (roomGoalTarget !== null && amount > roomGoalTarget) {
      setPersonalGoalError(
        copy.manageProject.personalGoalErrorAboveRoom(formatMoney(roomGoalTarget)),
      );
      return;
    }
    if (amount < yourBucketTargetTotal) {
      setPersonalGoalError(
        copy.manageProject.personalGoalErrorBelowBuckets(formatMoney(yourBucketTargetTotal)),
      );
      return;
    }
    const result = await saveMemberGoal({ target_amount: amount });
    if (result.error) {
      setPersonalGoalError(result.error);
      return;
    }
    setPersonalGoalError(null);
    setActiveModal(null);
    setMessage(copy.manageProject.personalGoalSuccess);
  }

  async function handleUpdateBucket(bucket: Bucket, next: { name: string; target_amount: number; deadline?: string | null; saving_rule_type?: SavingRuleType | null; saving_rule_amount?: number | null; saving_rule_start_amount?: number | null; saving_rule_increment?: number | null; saving_rule_cap?: number | null; saving_rule_day_count?: number | null; saving_rule_start_date?: string | null; reminder_day?: number | null }) {
    if (hasDuplicateBucketName(buckets, next.name, bucket.id)) {
      const error = copy.bucket.duplicateName(next.name.trim());
      setMessage(error);
      return { error, code: 'duplicate_name' as const, duplicateName: next.name.trim() };
    }
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
        ? {
            id: item.id,
            name: next.name,
            target_amount: next.target_amount,
            category: item.category,
            ...(next.deadline !== undefined && { deadline: next.deadline }),
            ...(next.saving_rule_type !== undefined && { saving_rule_type: next.saving_rule_type }),
            ...(next.saving_rule_amount !== undefined && { saving_rule_amount: next.saving_rule_amount }),
            ...(next.saving_rule_start_amount !== undefined && { saving_rule_start_amount: next.saving_rule_start_amount }),
            ...(next.saving_rule_increment !== undefined && { saving_rule_increment: next.saving_rule_increment }),
            ...(next.saving_rule_cap !== undefined && { saving_rule_cap: next.saving_rule_cap }),
            ...(next.saving_rule_day_count !== undefined && { saving_rule_day_count: next.saving_rule_day_count }),
            ...(next.saving_rule_start_date !== undefined && { saving_rule_start_date: next.saving_rule_start_date }),
            ...(next.reminder_day !== undefined && { reminder_day: next.reminder_day }),
          }
        : { id: item.id, name: item.name, target_amount: item.target_amount, category: item.category }),
    );

    if (result.error) {
      const error = result.code === 'duplicate_name'
        ? copy.bucket.duplicateName(result.duplicateName ?? next.name.trim())
        : result.error;
      setMessage(error);
      return { ...result, error };
    }

    setMessage(copy.bucket.updatedSuccess);
    haptic('success');
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

  async function handleTransferOwnership() {
    if (!activeRoomId || !selectedTransferMember) return;
    const result = await transferOwnership(activeRoomId, selectedTransferMember);
    if (result.error) {
      setMessage(copy.manageProject.transferErrorGeneric);
      setConfirmingTransfer(false);
      return;
    }
    haptic('success');
    setConfirmingTransfer(false);
    setActiveModal(null);
    setSelectedTransferMember(null);
    setMessage(copy.manageProject.transferSuccess);
    await refetchRooms();
  }

  const isRoomFull = members.length === 7;
  const projectBasicsItems = [
    {
      id: 'project-name',
      icon: <IconEdit size={18} />,
      label: copy.manageProject.projectNameLabel,
      description: isCreator ? activeRoom.name : copy.manageProject.renameNonCreatorHint,
      meta: isCreator ? (
        <span className="copy-allowed max-w-[10rem] truncate font-mono text-xs text-ink">{activeRoom.name}</span>
      ) : undefined,
      onClick: isCreator ? () => openModal('rename-room') : undefined,
    },
    {
      id: 'invite',
      icon: <IconQrCode size={18} />,
      label: copy.manageProject.inviteCodeLabel,
      description: isRoomFull
        ? copy.manageProject.inviteCodeFullHint
        : copy.manageProject.inviteCodeDesc,
      meta: <span className="copy-allowed font-mono text-xs text-brand-800">{activeRoom.invite_code}</span>,
      onClick: isRoomFull ? undefined : () => openModal('invite-code'),
    },
  ];

  const savingControlItems = [
    {
      id: 'room-goal',
      icon: <IconEdit size={18} />,
      label: copy.manageProject.sectionRoomGoal,
      description: isCreator
        ? (roomGoalTarget !== null
            ? copy.manageProject.roomGoalCurrent(formatMoney(roomGoalTarget))
            : copy.manageProject.roomGoalNotSet)
        : copy.manageProject.roomGoalReadOnlyHint,
      meta: roomGoalTarget !== null ? (
        <span className="copy-allowed font-mono text-xs text-ink">{formatMoney(roomGoalTarget)}</span>
      ) : undefined,
      onClick: isCreator ? () => openModal('room-goal') : undefined,
    },
    {
      id: 'personal-goal',
      icon: <IconEdit size={18} />,
      label: copy.manageProject.sectionPersonalGoal,
      description: personalGoalTarget !== null
        ? copy.manageProject.personalGoalCurrent(formatMoney(personalGoalTarget))
        : copy.manageProject.personalGoalNotSet,
      meta: personalGoalTarget !== null ? (
        <span className="copy-allowed font-mono text-xs text-ink">{formatMoney(personalGoalTarget)}</span>
      ) : undefined,
      onClick: () => openModal('personal-goal'),
    },
    {
      id: 'buckets',
      icon: <IconPiggyBank size={18} />,
      label: copy.manageProject.manageBucketsModalTitle,
      description: copy.dashboard.bucketCount(buckets.length),
      meta: (
        <span className="copy-allowed font-mono text-xs text-ink">
          {formatMoney(yourBucketTargetTotal)}
        </span>
      ),
      onClick: () => openModal('buckets'),
    },
    // Quick amounts feature hidden for now
    // {
    //   id: 'quick',
    //   icon: <IconPiggyBank size={18} />,
    //   label: copy.manageProject.quickAmountsLabel,
    //   description: quickAmounts.map(formatMoney).join(' / '),
    //   onClick: () => openModal('quick-amounts'),
    // },
  ];

  const otherMembers = members.filter(m => m.userId !== user?.id);

  const roomActionItems = [
    ...(isCreator && otherMembers.length > 0
      ? [{
          id: 'transfer',
          icon: <IconShield size={18} />,
          label: copy.manageProject.transferOwnershipLabel,
          description: copy.manageProject.transferOwnershipDesc,
          onClick: () => {
            setSelectedTransferMember(null);
            openModal('transfer-ownership');
          },
        }]
      : []),
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
    <div className="flex flex-col gap-6 px-5 pt-8">
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
      <section aria-busy={membersLoading}>
        <div className="flex items-center gap-2">
          <h2 className="font-mono text-lg font-bold leading-tight text-ink">
            {copy.manageProject.sectionMembers}
          </h2>
          {members.length > 0 && (
            <Chip tone={isRoomFull ? 'white' : 'peach'}>
              {copy.manageProject.memberCapacity(members.length)}
            </Chip>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {membersLoading && shouldShowMemberSkeleton ? (
            <>
              <MemberRowSkeleton />
              <MemberRowSkeleton />
            </>
          ) : membersLoading ? null : membersError && members.length === 0 ? (
            <p className="rounded-lg bg-danger-soft px-3 py-2 font-mono text-xs text-danger">
              {copy.manageProject.memberListErrorBody}
            </p>
          ) : members.length === 0 ? (
            <p className="rounded-lg bg-surface px-3 py-2 font-mono text-xs text-ink-muted shadow-soft">
              {copy.manageProject.memberListEmptyBody}
            </p>
          ) : (
            <>
              {members.map(member => {
                const isYou = member.userId === user?.id;
                const isCreator = member.userId === activeRoom.created_by;
                const fallback = firstGrapheme(member.displayName);
                const dateLabel = formatJoinedDate(member.joinedAt, language);
                const joinedDateLabel = dateLabel
                  ? copy.manageProject.memberJoinedAt(dateLabel)
                  : copy.manageProject.memberJoinedUnknown;
                return (
                  <RoomMemberRow
                    key={member.userId}
                    name={member.displayName}
                    fallback={fallback}
                    imageUrl={member.avatarUrl}
                    themeColor={member.themeColor ?? undefined}
                    joinedDateLabel={joinedDateLabel}
                    isYou={isYou}
                    isCreator={isCreator}
                    creatorBadgeLabel={copy.manageProject.creatorBadge}
                    youSuffix={isYou ? copy.manageProject.memberYouSuffix(member.displayName) : undefined}
                  />
                );
              })}
              {members.length === 1 && (
                <p className="font-mono text-xs text-ink-muted">
                  {copy.manageProject.memberListSoloHint}
                </p>
              )}
              {membersError && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 font-mono text-xs text-danger">
                  {copy.manageProject.memberListErrorBody}
                </p>
              )}
            </>
          )}
        </div>
      </section>
      <SettingsList label={copy.manageProject.sectionSavingControls} items={savingControlItems} />
      <SettingsList label={copy.manageProject.sectionRoomActions} items={roomActionItems} archiveItem={archiveItem} />
      <Modal open={activeModal === 'rename-room'} title={copy.manageProject.renameTitle} onClose={closeModal}>
        {(() => {
          const trimmed = renameDraft.trim();
          const currentTrimmed = (activeRoom.name ?? '').trim();
          const hasControl = /[\p{Cc}]/u.test(renameDraft);
          const disabled =
            renaming ||
            trimmed === '' ||
            trimmed.length > ROOM_NAME_MAX_LENGTH ||
            hasControl ||
            trimmed === currentTrimmed;
          return (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-xs text-ink-muted">{copy.manageProject.renameInputLabel}</span>
                <input
                  type="text"
                  value={renameDraft}
                  maxLength={ROOM_NAME_MAX_LENGTH}
                  placeholder={copy.manageProject.renamePlaceholder}
                  onChange={e => { setRenameDraft(e.target.value); setRenameError(null); }}
                  className="rounded-lg bg-well px-3 py-2 font-mono text-sm text-ink shadow-neuPressed outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                />
                <span className="self-end font-mono text-[11px] text-ink-dim">
                  {copy.manageProject.renameCharCounter(trimmed.length, ROOM_NAME_MAX_LENGTH)}
                </span>
              </label>
              {renameError && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 font-mono text-xs text-danger">{renameError}</p>
              )}
              <div className={MODAL_ACTION_ROW_REVERSE_CLASS}>
                <Button variant="action" fullWidth size="md" disabled={disabled} onClick={handleRenameSave}>
                  {copy.manageProject.renameSave}
                </Button>
                <Button variant="ghost" fullWidth size="md" className={MODAL_SECONDARY_BUTTON_CLASS} onClick={closeModal}>
                  {copy.manageProject.renameCancel}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>
      <Modal open={activeModal === 'room-goal'} title={copy.manageProject.roomGoalEditTitle} onClose={closeModal}>
        <div className="flex flex-col gap-4">
          {roomGoalError && (
            <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{roomGoalError}</p>
          )}
          <FormField label={copy.manageProject.endDateLabel}>
            <TextInput
              type="date"
              value={roomGoalDate}
              onChange={event => setRoomGoalDate(event.target.value)}
            />
          </FormField>
          <FormField label={copy.manageProject.targetAmountLabel}>
            <TextInput
              type="number"
              min={0}
              step={100}
              inputMode="decimal"
              placeholder={copy.manageProject.targetAmountPlaceholder}
              value={roomGoalAmount}
              onChange={event => setRoomGoalAmount(event.target.value.replace(/[^0-9]/g, ''))}
            />
          </FormField>
          <Button variant="primary" fullWidth size="md" onClick={handleRoomGoalSubmit}>
            {copy.manageProject.saveButton}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        open={pendingRoomGoal !== null}
        title={copy.manageProject.tripGoalConfirmTitle}
        body={copy.manageProject.tripGoalConfirmBody}
        confirmLabel={copy.manageProject.tripGoalConfirmLabel}
        onCancel={() => setPendingRoomGoal(null)}
        onConfirm={confirmRoomGoalSave}
      />
      <Modal open={activeModal === 'personal-goal'} title={copy.manageProject.personalGoalEditTitle} onClose={closeModal}>
        <div className="flex flex-col gap-4">
          {personalGoalError && (
            <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{personalGoalError}</p>
          )}
          <FormField
            label={copy.manageProject.personalGoalLabel}
            helper={roomGoalTarget !== null
              ? copy.manageProject.personalGoalHelper(formatMoney(roomGoalTarget))
              : undefined}
          >
            <TextInput
              type="number"
              min={0}
              step={100}
              inputMode="decimal"
              placeholder={copy.manageProject.targetAmountPlaceholder}
              value={personalGoalAmount}
              onChange={event => setPersonalGoalAmount(event.target.value.replace(/[^0-9]/g, ''))}
            />
          </FormField>
          <Button variant="primary" fullWidth size="md" onClick={handlePersonalGoalSubmit}>
            {copy.manageProject.personalGoalSaveButton}
          </Button>
        </div>
      </Modal>
      <Modal open={activeModal === 'invite-code'} title={copy.manageProject.inviteCodeModalTitle} onClose={closeModal}>
        <div className="flex flex-col gap-3 text-center">
          <span className="copy-allowed font-mono text-3xl font-bold tracking-[0.4em] text-brand-700">{activeRoom.invite_code}</span>
          <Button
            variant="action"
            fullWidth
            size="md"
            onClick={() => {
              navigator.clipboard?.writeText(activeRoom.invite_code);
              setMessage(copy.manageProject.copiedMessage);
            }}
          >
            {copy.manageProject.copyCodeButton}
          </Button>
        </div>
      </Modal>
      {/* Quick amounts editor hidden for now */}
      <Modal
        open={activeModal === 'buckets'}
        title={copy.manageProject.manageBucketsModalTitle}
        onClose={closeBucketsModal}
        hidden={bucketTransferSheetOpen}
        deferContentUntilOpen
        deferredBodyReserveClassName="min-h-[52dvh] md:min-h-[28rem]"
      >
        <BucketManager
          buckets={buckets}
          logs={logs}
          transfers={bucketTransfers}
          allocations={balanceAllocations}
          goalTarget={goalTarget}
          roomEndDate={activeRoom?.end_date ?? null}
          onUpdate={handleUpdateBucket}
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
          onTransferSheetOpenChange={setBucketTransferSheetOpen}
          onRemoved={refetchBuckets}
          statusMessage={message}
        />
      </Modal>
      <Modal
        open={activeModal === 'transfer-ownership'}
        title={copy.manageProject.transferTitle}
        onClose={closeModal}
      >
        <div className="flex flex-col gap-4">
          <p className="font-mono text-sm text-ink-muted">
            {copy.manageProject.transferSelectMember}
          </p>
          <div className="flex flex-col gap-2">
            {otherMembers.map(member => {
              const fallback = firstGrapheme(member.displayName);
              const selected = selectedTransferMember === member.userId;
              return (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => setSelectedTransferMember(member.userId)}
                  className={`flex items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                    selected
                      ? 'bg-brand-50 ring-2 ring-brand-300'
                      : 'bg-surface shadow-soft hover:bg-well'
                  }`}
                >
                  <RoomMemberRow
                    name={member.displayName}
                    fallback={fallback}
                    imageUrl={member.avatarUrl}
                    themeColor={member.themeColor ?? undefined}
                    joinedDateLabel=""
                    isYou={false}
                    isCreator={false}
                    creatorBadgeLabel=""
                  />
                </button>
              );
            })}
          </div>
          <Button
            variant="primary"
            fullWidth
            size="md"
            disabled={!selectedTransferMember}
            onClick={() => setConfirmingTransfer(true)}
          >
            {copy.manageProject.transferConfirmLabel}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmingTransfer}
        title={copy.manageProject.transferConfirmTitle}
        body={copy.manageProject.transferConfirmBody(
          otherMembers.find(m => m.userId === selectedTransferMember)?.displayName ?? '',
        )}
        confirmLabel={copy.manageProject.transferConfirmLabel}
        danger
        onCancel={() => setConfirmingTransfer(false)}
        onConfirm={handleTransferOwnership}
      />
      <ConfirmModal
        open={confirmingArchive}
        title={copy.manageProject.archiveConfirmTitle}
        body={
          otherMembers.length > 0
            ? `${copy.manageProject.archiveConfirmBody}\n\n${copy.manageProject.archiveSuggestTransfer}`
            : copy.manageProject.archiveConfirmBody
        }
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

function MemberRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface p-3 shadow-soft">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-32 rounded-pill" />
        <Skeleton className="h-3 w-24 rounded-pill" />
      </div>
      <Skeleton className="h-6 w-16 rounded-pill" />
    </div>
  );
}
