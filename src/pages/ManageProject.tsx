import { useState } from 'react';
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
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useLogs } from '../hooks/useLogs';
import { usePartnerBuckets } from '../hooks/usePartnerBuckets';
import { useProfile } from '../hooks/useProfile';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import { sumTargets } from '../lib/buckets';
import { formatCurrency } from '../lib/format';
import { haptic } from '../lib/haptics';
import type { Bucket, BucketCategory } from '../types';

type ManageModal = 'trip-goal' | 'invite-code' | 'quick-amounts' | 'buckets' | null;

/**
 * Manage Project consolidates the per-room admin actions that used to
 * live as separate items inside Profile (trip date, invite code,
 * create project, archive project). It is reached by tapping
 * "Manage Project" on the Profile page — we deliberately do NOT add
 * a new bottom-nav button so the surface stays predictable.
 *
 * Joiners (created_by !== user.id) get a read-only view: they can
 * still see the invite code + trip date but the destructive actions
 * (archive, end-date edit) are hidden. The single-active-project
 * rule from migration 0021 only constrains creators.
 */
export function ManageProject() {
  const navigate = useNavigate();
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

  if (!activeRoom) {
    return (
      <section className="rounded-3xl bg-surface p-5 shadow-soft">
        <SectionLabel tone="brand">Manage Project</SectionLabel>
        <p className="mt-2 font-mono text-xs text-ink-muted">No active project. Create or join one from Profile.</p>
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
      setMessage('Pick a trip date first.');
      return;
    }
    const target = Number(targetAmountDraft);
    if (!Number.isFinite(target) || target <= 0) {
      setMessage('Enter a target amount greater than 0.');
      return;
    }
    if (target < highestMemberBucketTargetTotal) {
      setMessage(`Main goal must be at least ${formatCurrency(highestMemberBucketTargetTotal)} because existing bucket targets already use that much.`);
      return;
    }
    const goalResult = await saveRoomGoal({
      target_amount: target,
      end_date: tripDateDraft,
    });
    if (goalResult.error) { setMessage(goalResult.error); return; }
    await refetchRooms();
    setMessage('Trip goal updated.');
    closeModal();
  }

  async function handleQuickAmountsSave() {
    const result = await updateQuickAmounts(quickAmountDrafts.map(Number));
    if (result.error) setMessage(result.error);
    else {
      setMessage('Quick amounts updated.');
      closeModal();
    }
  }

  async function handleCreateBucket() {
    const target = Number(bucketTarget);
    if (!bucketCategory || !bucketName.trim() || target <= 0) {
      setMessage('Add a bucket name, target, and category.');
      return;
    }
    if (goalTarget !== null && yourBucketTargetTotal + target > goalTarget) {
      setMessage(`Bucket target exceeds remaining capacity. You have ${formatCurrency(Math.max(0, goalTarget - yourBucketTargetTotal))} remaining for bucket targets.`);
      return;
    }
    const result = await saveBuckets([
      ...buckets,
      { id: undefined, name: bucketName.trim(), target_amount: target, category: bucketCategory },
    ]);
    if (result.error) setMessage(result.error);
    else {
      haptic('success');
      setMessage('Bucket created.');
      setBucketName('');
      setBucketTarget('');
    }
  }

  async function handleUpdateBucket(bucket: Bucket, next: { name: string; target_amount: number }) {
    if (goalTarget !== null) {
      const capacityForBucket = goalTarget - (yourBucketTargetTotal - bucket.target_amount);
      if (next.target_amount > capacityForBucket) {
        const error = `Bucket target exceeds remaining capacity. You have ${formatCurrency(Math.max(0, capacityForBucket))} available for this bucket.`;
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

    setMessage('Bucket updated.');
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

    setMessage('Bucket deleted.');
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
      label: 'Invite Code',
      description: 'Share with your partner to join this project',
      meta: <span className="copy-allowed font-mono text-xs text-brand-800">{activeRoom.invite_code}</span>,
      onClick: () => openModal('invite-code'),
    },
    {
      id: 'date',
      icon: <IconCalendar size={18} />,
      label: 'Trip Goal',
      description: activeRoom.end_date ?? 'Not set',
      meta: <span className="font-mono text-xs text-ink-muted">{goal ? formatCurrency(goal.target_amount) : ''}</span>,
      onClick: isCreator ? () => openModal('trip-goal') : undefined,
    },
  ];

  const savingControlItems = [
    {
      id: 'quick',
      icon: <IconPiggyBank size={18} />,
      label: 'Quick Amounts',
      description: quickAmounts.map(formatCurrency).join(' / '),
      onClick: () => openModal('quick-amounts'),
    },
    {
      id: 'buckets',
      icon: <IconGear size={18} />,
      label: 'Manage Buckets',
      description: `${buckets.length} active`,
      onClick: () => openModal('buckets'),
    },
  ];

  const roomActionItems = [
    {
      id: 'create-another',
      icon: <IconUserPlus size={18} />,
      label: 'Create another project',
      description: 'Archives this project. One active project per creator.',
      onClick: isCreator ? () => navigate('/profile?intent=create-project') : undefined,
    },
  ];

  const archiveItem = {
    id: 'archive',
    icon: <IconTrash size={18} />,
    label: isCreator ? 'Archive Project' : 'Leave Project',
    description: isCreator
      ? 'Partners will see this project as offline (read-only).'
      : 'Your partner keeps the project. You can rejoin later with the invite code.',
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
          aria-label="Back to Profile"
        >
          <IconArrowLeft size={14} /> Profile
        </button>
      </div>
      <PageHeader eyebrow="Project" title="Manage Project" subtitle={activeRoom.name} />
      {message && <p className="rounded-2xl bg-brand-50 px-4 py-3 font-mono text-xs text-brand-800">{message}</p>}
      <SettingsList label="Project Basics" items={projectBasicsItems} />
      <SettingsList label="Saving Controls" items={savingControlItems} />
      <SettingsList label="Room Actions" items={roomActionItems} archiveItem={archiveItem} />
      <Modal open={activeModal === 'trip-goal'} title="Trip Goal" onClose={closeModal}>
        <div className="flex flex-col gap-4">
          <FormField label="End Date">
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
            label="Target Amount (THB)"
            helper={`${formatCurrency(Math.max(0, effectiveGoalDraftAmount - yourBucketTargetTotal))} remaining for your bucket targets`}
            error={goalDraftTooLow ? `Main goal must be at least ${formatCurrency(highestMemberBucketTargetTotal)} to cover existing bucket targets.` : undefined}
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
          <Button variant="primary" fullWidth onClick={handleTripGoalSave}>Save</Button>
        </div>
      </Modal>
      <Modal open={activeModal === 'invite-code'} title="Invite Code" onClose={closeModal}>
        <div className="flex flex-col gap-3 text-center">
          <span className="copy-allowed font-mono text-3xl font-bold tracking-[0.4em] text-brand-700">{activeRoom.invite_code}</span>
          <p className="font-mono text-xs text-ink-muted">Share this 6-character code with your partner.</p>
          <Button
            variant="action"
            fullWidth
            onClick={() => {
              navigator.clipboard?.writeText(activeRoom.invite_code);
              setMessage('Copied invite code to clipboard.');
            }}
          >
            Copy Code
          </Button>
        </div>
      </Modal>
      <Modal open={activeModal === 'quick-amounts'} title="Quick Amounts" onClose={closeModal}>
        <QuickAmountsEditor
          amounts={quickAmountDrafts}
          onChange={setQuickAmountDrafts}
          onSave={handleQuickAmountsSave}
        />
      </Modal>
      <Modal open={activeModal === 'buckets'} title="Manage Buckets" onClose={closeModal}>
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
        title="Archive project?"
        body="Your partner will see this project as offline with read-only access. You can restore it from Manage Project later."
        confirmLabel="Archive"
        danger
        onCancel={() => setConfirmingArchive(false)}
        onConfirm={handleArchive}
      />
      <ConfirmModal
        open={confirmingLeave}
        title="Leave project?"
        body="You'll no longer see this project on your dashboard. The project creator stays in and can keep working solo or invite a new partner. You can rejoin later if they share the invite code."
        confirmLabel="Leave"
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
  const remaining = Math.max(0, goalTarget - allocated);
  const partnerLine = partnerAllocated !== null && partnerAllocated > allocated
    ? `Partner bucket targets use ${formatCurrency(partnerAllocated)}.`
    : null;

  return (
    <div className="rounded-2xl bg-brand-50 px-4 py-3 font-mono text-xs text-ink-muted">
      <p className="font-bold text-ink">Main goal target: {formatCurrency(goalTarget)}</p>
      <p className="mt-1">{formatCurrency(allocated)} allocated of {formatCurrency(goalTarget)}</p>
      <p className="mt-1">{formatCurrency(remaining)} remaining for bucket targets</p>
      {partnerLine && <p className="mt-1 text-brand-800">{partnerLine}</p>}
    </div>
  );
}

const bucketOptions = [
  { id: 'flight' as const, label: 'Flight', icon: <IconPlane size={22} /> },
  { id: 'accom' as const, label: 'Stay', icon: <IconBed size={22} /> },
  { id: 'dining' as const, label: 'Dining', icon: <IconFork size={22} /> },
  { id: 'activities' as const, label: 'Activity', icon: <IconTicket size={22} /> },
  { id: 'gear' as const, label: 'Gear', icon: <IconSmartphone size={22} /> },
  { id: 'home' as const, label: 'Home', icon: <IconHome size={22} /> },
  { id: 'other' as const, label: 'Other', icon: <IconBriefcase size={22} /> },
];
