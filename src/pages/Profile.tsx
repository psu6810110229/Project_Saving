import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { ConfirmModal } from '../components/ConfirmModal/ConfirmModal';
import { CreateBucketForm } from '../components/CreateBucketForm/CreateBucketForm';
import { CreateProjectForm } from '../components/CreateProjectForm/CreateProjectForm';
import { FormField } from '../components/FormField/FormField';
import {
  IconBed,
  IconBell,
  IconBriefcase,
  IconCalendar,
  IconEdit,
  IconFork,
  IconGear,
  IconHeart,
  IconHome,
  IconPalette,
  IconPiggyBank,
  IconPlane,
  IconQrCode,
  IconSmartphone,
  IconTicket,
  IconTrash,
  IconUser,
  IconUserPlus,
} from '../components/Icon/Icon';
import { JoinProjectFlow } from '../components/JoinProjectFlow/JoinProjectFlow';
import { Modal } from '../components/Modal/Modal';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { ProfileHeader } from '../components/ProfileHeader/ProfileHeader';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { SettingsList } from '../components/SettingsList/SettingsList';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { Spinner } from '../components/Spinner/Spinner';
import { TextInput } from '../components/TextInput/TextInput';
import { ThemeSwatchPicker } from '../components/ThemeSwatchPicker/ThemeSwatchPicker';
import { VersionBadge } from '../components/VersionBadge/VersionBadge';
import { useAuth } from '../hooks/useAuth';
import { useBuckets } from '../hooks/useBuckets';
import { useGoal } from '../hooks/useGoal';
import { useLogs } from '../hooks/useLogs';
import { useProfile } from '../hooks/useProfile';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import { bucketSaved } from '../lib/buckets';
import { fallbackInitial } from '../lib/dashboardStats';
import { formatCurrency } from '../lib/format';
import type { ThemeSwatch } from '../lib/theme';
import type { BucketCategory, ProjectCategory } from '../types';

type ProfileModal = 'profile' | 'theme' | 'buckets' | 'trip-date' | 'quick-amounts' | 'create-project' | 'join-project' | null;

export function Profile() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { activeRoom, activeRoomId } = useRoom();
  const { createRoom, joinRoomByCode, archiveRoom, updateRoom } = useRooms();
  const { profile, loading, error, themeColor, quickAmounts, updateProfile, updateQuickAmounts } = useProfile();
  const { goal } = useGoal(activeRoomId);
  const { buckets, saveBuckets } = useBuckets(activeRoomId);
  const { logs } = useLogs(100, activeRoomId);
  const [activeModal, setActiveModal] = useState<ProfileModal>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null);
  const [themeDraft, setThemeDraft] = useState<ThemeSwatch | null>(null);
  const [bucketCategory, setBucketCategory] = useState<BucketCategory | null>('flight');
  const [bucketName, setBucketName] = useState('Flights');
  const [bucketTarget, setBucketTarget] = useState('30000');
  const [projectCategory, setProjectCategory] = useState<ProjectCategory | null>('travel');
  const [projectName, setProjectName] = useState('Japan 2027');
  const [projectTarget, setProjectTarget] = useState('100000');
  const [projectEndDate, setProjectEndDate] = useState('2027-11-01');
  const [tripDateDraft, setTripDateDraft] = useState(activeRoom?.end_date ?? '');
  const [quickAmountDrafts, setQuickAmountDrafts] = useState<string[]>(quickAmounts.map(String));
  const [joinCode, setJoinCode] = useState('');

  if (loading) return <ProfileSkeleton />;
  if (error) return <StatusCard title="Profile needs a refresh" body={error} />;

  const displayName = displayNameDraft ?? profile?.display_name ?? '';
  const theme = themeDraft ?? themeColor;

  function openModal(next: ProfileModal) {
    if (next === 'trip-date') setTripDateDraft(activeRoom?.end_date ?? '');
    if (next === 'quick-amounts') setQuickAmountDrafts(quickAmounts.map(String));
    setActiveModal(next);
    setMessage(null);
  }

  function closeModal() {
    setActiveModal(null);
    setMessage(null);
  }

  async function handleProfileSave() {
    const result = await updateProfile({ display_name: displayName, theme_color: theme });
    if (!result.error) {
      setDisplayNameDraft(null);
      setThemeDraft(null);
    }
    setMessage(result.error ?? 'Profile updated.');
  }

  async function handleCreateBucket() {
    const target = Number(bucketTarget);
    if (!bucketCategory || !bucketName.trim() || target <= 0) {
      setMessage('Add a bucket name, target, and category.');
      return;
    }
    const result = await saveBuckets([
      ...buckets,
      { id: undefined, name: bucketName.trim(), target_amount: target, category: bucketCategory },
    ]);
    if (result.error) setMessage(result.error);
    else {
      setMessage('Bucket created.');
      setBucketName('');
      setBucketTarget('');
    }
  }

  async function handleCreateProject() {
    const target = Number(projectTarget);
    if (!projectCategory || !projectName.trim() || !projectEndDate || target <= 0) {
      setMessage('Fill in the project details first.');
      return;
    }
    const result = await createRoom({
      name: projectName,
      target_amount: target,
      end_date: projectEndDate,
      category: projectCategory,
    });
    if (result.error) setMessage(result.error);
    else {
      closeModal();
      navigate('/dashboard');
    }
  }

  async function handleTripDateSave() {
    if (!activeRoomId || !tripDateDraft) return;
    const result = await updateRoom(activeRoomId, { end_date: tripDateDraft });
    if (result.error) setMessage(result.error);
    else {
      setMessage('Trip date updated.');
      closeModal();
    }
  }

  async function handleQuickAmountsSave() {
    const result = await updateQuickAmounts(quickAmountDrafts.map(Number));
    if (result.error) setMessage(result.error);
    else {
      setMessage('Quick amounts updated.');
      closeModal();
    }
  }

  async function handleJoinProject() {
    const result = await joinRoomByCode(joinCode);
    if (result.error) setMessage(result.error);
    else {
      closeModal();
      navigate('/dashboard');
    }
  }

  async function handleArchive() {
    if (!activeRoomId) return;
    const result = await archiveRoom(activeRoomId);
    if (result.error) setMessage(result.error);
    else {
      setConfirmingArchive(false);
      navigate('/dashboard');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Profile" title="Settings" subtitle={activeRoom?.name ?? 'Project settings'} />
      <ProfileHeader
        name={profile?.display_name ?? 'You'}
        fallback={fallbackInitial(profile?.display_name)}
        avatarUrl={profile?.avatar_url}
        memberLabel={`${activeRoom?.name ?? 'Project'} member`}
        themeColor={themeColor}
        onEdit={() => openModal('profile')}
      />
      {message && <p className="rounded-2xl bg-brand-50 px-4 py-3 font-mono text-xs text-brand-800">{message}</p>}
      <SettingsList
        items={[
          { id: 'profile', icon: <IconEdit size={18} />, label: 'Edit Profile', description: 'Display name and theme', onClick: () => openModal('profile') },
          { id: 'theme', icon: <IconPalette size={18} />, label: 'Theme Colors', description: 'Personal swatch shown to Art', onClick: () => openModal('theme') },
          { id: 'invite', icon: <IconQrCode size={18} />, label: 'Project Invite Code', meta: <span className="font-mono text-xs text-brand-800">{activeRoom?.invite_code ?? '------'}</span> },
          { id: 'buckets', icon: <IconGear size={18} />, label: 'Manage Buckets', description: `${buckets.length} active`, onClick: () => openModal('buckets') },
          {
            id: 'date',
            icon: <IconCalendar size={18} />,
            label: 'Trip Date',
            description: activeRoom?.end_date ?? 'Not set',
            meta: <span className="font-mono text-xs text-ink-muted">{goal ? formatCurrency(goal.target_amount) : ''}</span>,
            onClick: activeRoom?.created_by === user?.id ? () => openModal('trip-date') : undefined,
          },
          { id: 'quick', icon: <IconPiggyBank size={18} />, label: 'Quick Amounts', description: quickAmounts.map(formatCurrency).join(' / '), onClick: () => openModal('quick-amounts') },
          { id: 'create', icon: <IconUserPlus size={18} />, label: 'Create Project', description: 'Start another savings vault', onClick: () => openModal('create-project') },
          { id: 'join', icon: <IconBell size={18} />, label: 'Join Project', description: 'Use a 6-character invite code', onClick: () => openModal('join-project') },
          { id: 'signout', icon: <IconUser size={18} />, label: 'Sign Out', onClick: () => setConfirmingSignOut(true) },
        ]}
        archiveItem={{
          id: 'archive',
          icon: <IconTrash size={18} />,
          label: 'Archive Project',
          description: 'Hide this project from your vault.',
          onClick: () => setConfirmingArchive(true),
        }}
      />
      <VersionBadge />
      <Modal open={activeModal === 'profile'} title="Edit Profile" onClose={closeModal}>
        <div className="flex flex-col gap-4">
          <FormField label="Display Name">
            <TextInput value={displayName} leadingIcon={<IconEdit size={16} />} onChange={event => setDisplayNameDraft(event.target.value)} />
          </FormField>
          <ThemeSwatchPicker value={theme} onChange={setThemeDraft} />
          <Button variant="primary" fullWidth onClick={handleProfileSave}>Save Profile</Button>
        </div>
      </Modal>
      <Modal open={activeModal === 'theme'} title="Theme Colors" onClose={closeModal}>
        <div className="flex flex-col gap-4">
          <ThemeSwatchPicker value={theme} onChange={setThemeDraft} />
          <Button variant="primary" fullWidth onClick={handleProfileSave}>Save Theme</Button>
        </div>
      </Modal>
      <Modal open={activeModal === 'buckets'} title="Manage Buckets" onClose={closeModal}>
        <div className="flex flex-col gap-4">
          <BucketSummary buckets={buckets} logs={logs} />
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
      <Modal open={activeModal === 'trip-date'} title="Edit Trip Date" onClose={closeModal}>
        <div className="flex flex-col gap-4">
          <FormField label="Trip Date">
            <TextInput value={tripDateDraft} type="date" leadingIcon={<IconCalendar size={16} />} onChange={event => setTripDateDraft(event.target.value)} />
          </FormField>
          <Button variant="primary" fullWidth onClick={handleTripDateSave}>Save Date</Button>
        </div>
      </Modal>
      <Modal open={activeModal === 'quick-amounts'} title="Quick Amounts" onClose={closeModal}>
        <div className="flex flex-col gap-3">
          {quickAmountDrafts.map((amount, index) => (
            <div key={index} className="flex items-center gap-2">
              <FormField label={`Amount ${index + 1}`}>
                <TextInput
                  value={amount}
                  inputMode="numeric"
                  leadingIcon={<IconPiggyBank size={16} />}
                  onChange={event => setQuickAmountDrafts(prev => prev.map((item, itemIndex) => (
                    itemIndex === index ? event.target.value.replace(/[^0-9]/g, '') : item
                  )))}
                />
              </FormField>
              {quickAmountDrafts.length > 1 && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setQuickAmountDrafts(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          {quickAmountDrafts.length < 6 && (
            <Button variant="ghost" size="md" onClick={() => setQuickAmountDrafts(prev => [...prev, ''])}>
              Add Amount
            </Button>
          )}
          <Button variant="primary" fullWidth onClick={handleQuickAmountsSave}>Save Quick Amounts</Button>
        </div>
      </Modal>
      <Modal open={activeModal === 'create-project'} title="Create Project" onClose={closeModal}>
        <CreateProjectForm
          category={projectCategory}
          options={projectOptions}
          name={projectName}
          target={projectTarget}
          endDate={projectEndDate}
          onCategoryChange={setProjectCategory}
          onNameChange={setProjectName}
          onTargetChange={value => setProjectTarget(value.replace(/[^0-9]/g, ''))}
          onEndDateChange={setProjectEndDate}
          onSubmit={handleCreateProject}
        />
      </Modal>
      <Modal open={activeModal === 'join-project'} title="Join Project" onClose={closeModal}>
        <JoinProjectFlow
          code={joinCode}
          error={joinCode.length > 0 && joinCode.length < 6 ? 'Enter the full 6-character code.' : undefined}
          preview={joinCode.length >= 6 ? joinPreview(joinCode) : null}
          onCodeChange={setJoinCode}
          onJoin={handleJoinProject}
        />
      </Modal>
      <ConfirmModal
        open={confirmingSignOut}
        title="Sign out?"
        body="You will return to the login screen. Your project data stays saved."
        confirmLabel="Sign Out"
        danger
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={signOut}
      />
      <ConfirmModal
        open={confirmingArchive}
        title="Archive project?"
        body="This hides the active project from your vault list."
        confirmLabel="Archive"
        danger
        onCancel={() => setConfirmingArchive(false)}
        onConfirm={handleArchive}
      />
    </div>
  );
}

function BucketSummary({
  buckets,
  logs,
}: {
  buckets: { id: string; name: string; target_amount: number }[];
  logs: ReturnType<typeof useLogs>['logs'];
}) {
  if (buckets.length === 0) {
    return <p className="font-mono text-xs text-ink-muted">No buckets yet. Create one below.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {buckets.map(bucket => (
        <div key={bucket.id} className="rounded-2xl bg-brand-50 px-4 py-3 font-mono text-xs text-ink-muted">
          <span className="font-bold text-ink">{bucket.name}</span>
          {' '}
          {formatCurrency(bucketSaved(bucket.id, logs))} / {formatCurrency(bucket.target_amount)}
        </div>
      ))}
    </div>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-soft">
      <SectionLabel tone="brand">Profile</SectionLabel>
      <h1 className="mt-2 font-mono text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 font-mono text-xs text-ink-muted">{body}</p>
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading profile">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16 rounded-pill" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-44 rounded-pill" />
        </div>
        <Spinner size="sm" />
      </div>
      <section className="rounded-3xl bg-surface p-5 shadow-soft">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-48 rounded-pill" />
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </section>
    </div>
  );
}

const projectOptions = [
  { id: 'travel' as const, label: 'Travel', icon: <IconPlane size={28} /> },
  { id: 'gadget' as const, label: 'Gadget', icon: <IconSmartphone size={28} /> },
  { id: 'wedding' as const, label: 'Wedding', icon: <IconHeart size={28} /> },
  { id: 'home' as const, label: 'Home', icon: <IconHome size={28} /> },
  { id: 'other' as const, label: 'Other', icon: <IconBriefcase size={28} /> },
];

const bucketOptions = [
  { id: 'flight' as const, label: 'Flight', icon: <IconPlane size={22} /> },
  { id: 'accom' as const, label: 'Stay', icon: <IconBed size={22} /> },
  { id: 'dining' as const, label: 'Dining', icon: <IconFork size={22} /> },
  { id: 'activities' as const, label: 'Activity', icon: <IconTicket size={22} /> },
  { id: 'gear' as const, label: 'Gear', icon: <IconSmartphone size={22} /> },
  { id: 'home' as const, label: 'Home', icon: <IconHome size={22} /> },
];

function joinPreview(code: string) {
  return {
    icon: <IconPlane size={32} />,
    name: `Invite ${code.toUpperCase()}`,
    creatorName: 'Project owner',
    creatorFallback: 'P',
    memberCount: 2,
  };
}
