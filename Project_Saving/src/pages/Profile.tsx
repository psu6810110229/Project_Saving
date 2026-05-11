import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button/Button';
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
  IconPlane,
  IconQrCode,
  IconSmartphone,
  IconTicket,
  IconTrash,
  IconUser,
  IconUserPlus,
} from '../components/Icon/Icon';
import { JoinProjectFlow } from '../components/JoinProjectFlow/JoinProjectFlow';
import { ProfileHeader } from '../components/ProfileHeader/ProfileHeader';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { SettingsList } from '../components/SettingsList/SettingsList';
import { TextInput } from '../components/TextInput/TextInput';
import { ThemeSwatchPicker } from '../components/ThemeSwatchPicker/ThemeSwatchPicker';
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

type Panel = 'profile' | 'theme' | 'buckets' | 'create-project' | 'join-project';

export function Profile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const panel = searchParams.get('panel') as Panel | null;
  const { signOut } = useAuth();
  const { activeRoom, activeRoomId } = useRoom();
  const { createRoom, joinRoomByCode, archiveRoom } = useRooms();
  const { profile, loading, error, themeColor, updateProfile } = useProfile();
  const { goal } = useGoal(activeRoomId);
  const { buckets, saveBuckets } = useBuckets(activeRoomId);
  const { logs } = useLogs(100, activeRoomId);
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
  const [joinCode, setJoinCode] = useState('');

  if (loading) return <StatusCard title="Loading profile" body="Getting your profile and project settings." />;
  if (error) return <StatusCard title="Profile needs a refresh" body={error} />;

  const displayName = displayNameDraft ?? profile?.display_name ?? '';
  const theme = themeDraft ?? themeColor;

  function setPanel(next: Panel | null) {
    if (next) setSearchParams({ panel: next });
    else setSearchParams({});
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
    else navigate('/dashboard');
  }

  async function handleJoinProject() {
    const result = await joinRoomByCode(joinCode);
    if (result.error) setMessage(result.error);
    else navigate('/dashboard');
  }

  async function handleArchive() {
    if (!activeRoomId) return;
    const result = await archiveRoom(activeRoomId);
    if (result.error) setMessage(result.error);
    else navigate('/dashboard');
  }

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader
        name={profile?.display_name ?? 'You'}
        fallback={fallbackInitial(profile?.display_name)}
        avatarUrl={profile?.avatar_url}
        memberLabel={`${activeRoom?.name ?? 'Project'} member`}
        themeColor={themeColor}
        onEdit={() => setPanel('profile')}
      />
      {message && <p className="rounded-2xl bg-brand-50 px-4 py-3 font-mono text-xs text-brand-800">{message}</p>}
      <SettingsList
        items={[
          { id: 'profile', icon: <IconEdit size={18} />, label: 'Edit Profile', description: 'Display name and theme', onClick: () => setPanel('profile') },
          { id: 'theme', icon: <IconPalette size={18} />, label: 'Theme Colors', description: 'Personal swatch shown to Art', onClick: () => setPanel('theme') },
          { id: 'invite', icon: <IconQrCode size={18} />, label: 'Project Invite Code', meta: <span className="font-mono text-xs text-brand-800">{activeRoom?.invite_code ?? '------'}</span> },
          { id: 'buckets', icon: <IconGear size={18} />, label: 'Manage Buckets', description: `${buckets.length} active`, onClick: () => setPanel('buckets') },
          { id: 'date', icon: <IconCalendar size={18} />, label: 'Trip Date', description: activeRoom?.end_date ?? 'Not set', meta: <span className="font-mono text-xs text-ink-muted">{goal ? formatCurrency(goal.target_amount) : ''}</span> },
          { id: 'create', icon: <IconUserPlus size={18} />, label: 'Create Project', description: 'Start another savings vault', onClick: () => setPanel('create-project') },
          { id: 'join', icon: <IconBell size={18} />, label: 'Join Project', description: 'Use a 6-character invite code', onClick: () => setPanel('join-project') },
          { id: 'signout', icon: <IconUser size={18} />, label: 'Sign Out', onClick: signOut },
        ]}
        archiveItem={{
          id: 'archive',
          icon: <IconTrash size={18} />,
          label: 'Archive Project',
          description: 'Hide this project from your vault.',
          onClick: handleArchive,
        }}
      />
      {panel && (
        <section className="flex flex-col gap-3">
          <PanelHeader panel={panel} onClose={() => setPanel(null)} />
          {panel === 'profile' && (
            <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-soft">
              <FormField label="Display Name">
                <TextInput value={displayName} leadingIcon={<IconEdit size={16} />} onChange={event => setDisplayNameDraft(event.target.value)} />
              </FormField>
              <ThemeSwatchPicker value={theme} onChange={setThemeDraft} />
              <Button variant="primary" fullWidth onClick={handleProfileSave}>Save Profile</Button>
            </div>
          )}
          {panel === 'theme' && (
            <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-soft">
              <ThemeSwatchPicker value={theme} onChange={setThemeDraft} />
              <Button variant="primary" fullWidth onClick={handleProfileSave}>Save Theme</Button>
            </div>
          )}
          {panel === 'buckets' && (
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
          )}
          {panel === 'create-project' && (
            <div>
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
            </div>
          )}
          {panel === 'join-project' && (
            <div>
              <JoinProjectFlow
                code={joinCode}
                error={joinCode.length > 0 && joinCode.length < 6 ? 'Enter the full 6-character code.' : undefined}
                preview={joinCode.length >= 6 ? joinPreview(joinCode) : null}
                onCodeChange={setJoinCode}
                onJoin={handleJoinProject}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function PanelHeader({ panel, onClose }: { panel: Panel; onClose: () => void }) {
  const title = panel.replace('-', ' ');
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <SectionLabel tone="brand">Profile</SectionLabel>
        <h2 className="mt-1 font-mono text-xl font-bold capitalize text-ink">{title}</h2>
      </div>
      <Button variant="ghost" size="md" onClick={onClose}>Close</Button>
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
