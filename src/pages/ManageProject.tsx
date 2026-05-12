import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { ConfirmModal } from '../components/ConfirmModal/ConfirmModal';
import { FormField } from '../components/FormField/FormField';
import {
  IconArrowLeft,
  IconCalendar,
  IconQrCode,
  IconTrash,
  IconUserPlus,
} from '../components/Icon/Icon';
import { Modal } from '../components/Modal/Modal';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { SettingsList } from '../components/SettingsList/SettingsList';
import { TextInput } from '../components/TextInput/TextInput';
import { useAuth } from '../hooks/useAuth';
import { useGoal } from '../hooks/useGoal';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import { formatCurrency } from '../lib/format';

type ManageModal = 'trip-date' | 'invite-code' | null;

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
  const { goal } = useGoal(activeRoomId);
  const { archiveRoom, updateRoom } = useRooms();
  const [activeModal, setActiveModal] = useState<ManageModal>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tripDateDraft, setTripDateDraft] = useState(activeRoom?.end_date ?? '');

  if (!activeRoom) {
    return (
      <section className="rounded-3xl bg-surface p-5 shadow-soft">
        <SectionLabel tone="brand">Manage Project</SectionLabel>
        <p className="mt-2 font-mono text-xs text-ink-muted">No active project. Create or join one from Profile.</p>
      </section>
    );
  }

  const isCreator = activeRoom.created_by === user?.id;

  function openModal(next: ManageModal) {
    if (next === 'trip-date') setTripDateDraft(activeRoom?.end_date ?? '');
    setActiveModal(next);
    setMessage(null);
  }

  function closeModal() {
    setActiveModal(null);
    setMessage(null);
  }

  async function handleTripDateSave() {
    if (!activeRoomId || !tripDateDraft) return;
    const result = await updateRoom(activeRoomId, { end_date: tripDateDraft });
    if (result.error) setMessage(result.error);
    else { setMessage('Trip date updated.'); closeModal(); }
  }

  async function handleArchive() {
    if (!activeRoomId) return;
    const result = await archiveRoom(activeRoomId);
    if (result.error) { setMessage(result.error); setConfirmingArchive(false); return; }
    setConfirmingArchive(false);
    navigate('/profile');
  }

  const items = [
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
      label: 'Trip Date',
      description: activeRoom.end_date ?? 'Not set',
      meta: <span className="font-mono text-xs text-ink-muted">{goal ? formatCurrency(goal.target_amount) : ''}</span>,
      onClick: isCreator ? () => openModal('trip-date') : undefined,
    },
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
    label: isCreator ? 'Archive Project' : 'Leave Project (creator only)',
    description: isCreator
      ? 'Partners will see this project as offline (read-only).'
      : 'Only the project creator can archive.',
    onClick: isCreator ? () => setConfirmingArchive(true) : undefined,
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
      <SettingsList items={items} archiveItem={archiveItem} />
      <Modal open={activeModal === 'trip-date'} title="Trip Date" onClose={closeModal}>
        <div className="flex flex-col gap-4">
          <FormField label="End Date">
            <TextInput value={tripDateDraft} onChange={event => setTripDateDraft(event.target.value)} />
          </FormField>
          <Button variant="primary" fullWidth onClick={handleTripDateSave}>Save</Button>
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
      <ConfirmModal
        open={confirmingArchive}
        title="Archive project?"
        body="Your partner will see this project as offline with read-only access. You can restore it from Manage Project later."
        confirmLabel="Archive"
        danger
        onCancel={() => setConfirmingArchive(false)}
        onConfirm={handleArchive}
      />
    </div>
  );
}
