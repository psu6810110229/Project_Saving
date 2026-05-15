import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell/AppShell';
import type { BottomNavTab } from '../components/BottomNav/BottomNav';
import { Button } from '../components/Button/Button';
import { CreateProjectForm } from '../components/CreateProjectForm/CreateProjectForm';
import { JoinProjectFlow } from '../components/JoinProjectFlow/JoinProjectFlow';
import { PageTransition } from '../components/PageTransition/PageTransition';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import {
  IconBriefcase,
  IconHeart,
  IconHome,
  IconPlane,
  IconSmartphone,
} from '../components/Icon/Icon';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import { useProfile } from '../hooks/useProfile';
import { useI18n } from '../i18n/useI18n';
import { LANGUAGE_STORAGE_KEY, isLanguage } from '../i18n/languages';
import type { ProjectCategory } from '../types';

type SetupMode = 'create' | 'join';

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeRoom } = useRoom();
  const { loading, error, createRoom, joinRoomByCode } = useRooms();
  const { copy } = useI18n();
  const al = copy.appLayout;
  const activeTab = tabFromPath(location.pathname);

  return (
    <AppShell activeTab={activeTab} onTabChange={tab => navigate(pathFromTab(tab))}>
      <ProfileLanguageSync />
      {loading && <StatusCard title={al.loadingTitle} body={al.loadingBody} />}
      {!loading && error && <StatusCard title={al.errorTitle} body={error} />}
      {!loading && !error && !activeRoom && <ProjectSetup onCreate={createRoom} onJoin={joinRoomByCode} />}
      {!loading && !error && activeRoom && (
        <PageTransition transitionKey={location.pathname}>
          <Outlet />
        </PageTransition>
      )}
    </AppShell>
  );
}

/**
 * Adopt the persisted UI language from the user's profile once it loads.
 * The I18nProvider already hydrates from localStorage synchronously, so
 * this bridge only matters when the profile value differs (e.g. the user
 * picked Thai on another device).
 */
function ProfileLanguageSync() {
  const { profile } = useProfile();
  const { language, setLanguage } = useI18n();
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLanguage(stored)) return;
    } catch {
      // If storage is unavailable, profile remains the safest persisted source.
    }

    const next = profile?.ui_language;
    if (!isLanguage(next)) return;
    if (next === language) return;
    setLanguage(next);
  }, [profile?.ui_language, language, setLanguage]);
  return null;
}

function ProjectSetup({
  onCreate,
  onJoin,
}: {
  onCreate: ReturnType<typeof useRooms>['createRoom'];
  onJoin: ReturnType<typeof useRooms>['joinRoomByCode'];
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SetupMode>('create');
  const [category, setCategory] = useState<ProjectCategory | null>('travel');
  const [name, setName] = useState('Japan 2027');
  const [target, setTarget] = useState('100000');
  const [endDate, setEndDate] = useState('2027-11-01');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate() {
    const targetAmount = Number(target);
    if (!category || !name.trim() || !endDate || targetAmount <= 0) {
      setMessage('Fill in a project name, target, category, and end date.');
      return;
    }
    const result = await onCreate({ name, target_amount: targetAmount, end_date: endDate, category });
    if (result.error) setMessage(result.error);
    else navigate('/dashboard');
  }

  async function handleJoin() {
    const result = await onJoin(code);
    if (result.error) setMessage(result.error);
    else navigate('/dashboard');
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <SectionLabel tone="brand">GO-OUT</SectionLabel>
        <h1 className="mt-2 font-mono text-3xl font-bold text-ink">Start a savings project</h1>
        <p className="mt-2 font-mono text-xs text-ink-muted">Create the Japan trip vault or join with Art's code.</p>
      </header>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={mode === 'create' ? 'primary' : 'ghost'} size="md" onClick={() => setMode('create')}>
          Create
        </Button>
        <Button variant={mode === 'join' ? 'primary' : 'ghost'} size="md" onClick={() => setMode('join')}>
          Join
        </Button>
      </div>
      {message && <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>}
      {mode === 'create' ? (
        <CreateProjectForm
          category={category}
          options={projectOptions}
          name={name}
          target={target}
          endDate={endDate}
          onCategoryChange={setCategory}
          onNameChange={setName}
          onTargetChange={value => setTarget(value.replace(/[^0-9]/g, ''))}
          onEndDateChange={setEndDate}
          onSubmit={handleCreate}
        />
      ) : (
        <JoinProjectFlow
          code={code}
          error={code.length > 0 && code.length < 6 ? 'Enter the full 6-character code.' : undefined}
          preview={code.length >= 6 ? joinPreview(code) : null}
          onCodeChange={setCode}
          onJoin={handleJoin}
        />
      )}
    </div>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-xl bg-surface p-5 shadow-soft">
      <SectionLabel tone="brand">GO-OUT</SectionLabel>
      <h1 className="mt-2 font-mono text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 font-mono text-xs text-ink-muted">{body}</p>
    </section>
  );
}

function tabFromPath(pathname: string): BottomNavTab {
  if (pathname.startsWith('/add')) return 'add';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'dashboard';
}

function pathFromTab(tab: BottomNavTab): string {
  if (tab === 'add') return '/add';
  if (tab === 'profile') return '/profile';
  return '/dashboard';
}

const projectOptions = [
  { id: 'travel' as const, label: 'Travel', icon: <IconPlane size={28} /> },
  { id: 'gadget' as const, label: 'Gadget', icon: <IconSmartphone size={28} /> },
  { id: 'wedding' as const, label: 'Wedding', icon: <IconHeart size={28} /> },
  { id: 'home' as const, label: 'Home', icon: <IconHome size={28} /> },
  { id: 'other' as const, label: 'Other', icon: <IconBriefcase size={28} /> },
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
