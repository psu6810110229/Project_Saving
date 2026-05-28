import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { type ReactNode, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell/AppShell';
import type { BottomNavTab } from '../components/BottomNav/BottomNav';
import { Button } from '../components/Button/Button';
import { DataProvider } from '../components/DataContext/DataContext';
import { JoinProjectFlow } from '../components/JoinProjectFlow/JoinProjectFlow';
import { LoadingState } from '../components/LoadingState/LoadingState';
import { MilestoneCelebrationModal } from '../components/MilestoneCelebrationModal/MilestoneCelebrationModal';
import { PageTransition } from '../components/PageTransition/PageTransition';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { IconChevronRight, IconPlane, IconRocket, IconUserPlus } from '../components/Icon/Icon';
import { useAuth } from '../hooks/useAuth';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useMilestoneCrossings } from '../hooks/useMilestoneCrossings';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import { useProfile } from '../hooks/useProfile';
import { useSharedData } from '../hooks/useSharedData';
import { useI18n } from '../i18n/useI18n';
import { LANGUAGE_STORAGE_KEY, isLanguage } from '../i18n/languages';

type SetupMode = 'create' | 'join';

const ROOMLESS_ROUTES = ['/archived-projects', '/profile', '/create-room', '/join-room'];

function isRoomlessRoute(pathname: string): boolean {
  return ROOMLESS_ROUTES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Routes that are room-bound (require an active room) but must NOT mount
// `DataProvider`. The shared provider eagerly runs `useLogs` /
// `useReconcile`, which would otherwise pull private columns (notes, slip
// urls, balance checkpoints, balance adjustments) for any nested page —
// including Member Detail, which is intentionally restricted to a
// safe-fields-only data surface (Task 36).
const PRIVATE_DATA_FREE_ROUTES = ['/members'];

function isPrivateDataFreeRoute(pathname: string): boolean {
  return PRIVATE_DATA_FREE_ROUTES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeRoom } = useRoom();
  const { loading, error, refetch, joinRoomByCode } = useRooms();
  const { copy } = useI18n();
  const al = copy.appLayout;
  const { shouldShowLoader, fakeLoadingExpired } = useLoadingGate({
    loading,
    showAfterMs: 900,
  });
  const activeTab = tabFromPath(location.pathname);
  const outlet = useOutlet();
  const roomlessAllowed = isRoomlessRoute(location.pathname);
  const privateDataFree = isPrivateDataFreeRoute(location.pathname);

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={tab => {
        const nextPath = pathFromTab(tab);
        if (nextPath === location.pathname) return;
        navigate(nextPath, { replace: true });
      }}
    >
      <ProfileLanguageSync />
      {loading && shouldShowLoader && (
        <div className="flex h-full items-center justify-center px-2 pb-16 pt-8">
          <LoadingState
            variant="card"
            label={al.loadingTitle}
            title={al.loadingTitle}
            body={al.loadingBody}
            messages={copy.common.loadingMessages}
            slow={fakeLoadingExpired}
            slowMessage={copy.common.loadingSlow}
          />
        </div>
      )}
      {!loading && error && (
        <StatusCard
          title={al.errorTitle}
          body={error}
          actionLabel={copy.common.retry}
          onAction={() => void refetch({ showLoading: true })}
        />
      )}
      {!loading && !error && !activeRoom && !roomlessAllowed && (
        <PageTransition transitionKey="project-setup">
          <ProjectSetup onJoin={joinRoomByCode} />
        </PageTransition>
      )}
      {!loading && !error && !activeRoom && roomlessAllowed && (
        <PageTransition transitionKey={location.pathname}>
          {outlet}
        </PageTransition>
      )}
      {!loading && !error && activeRoom && privateDataFree && (
        <PageTransition transitionKey={location.pathname}>
          {outlet}
        </PageTransition>
      )}
      {!loading && !error && activeRoom && !privateDataFree && (
        <DataProvider roomId={activeRoom.id}>
          <PageTransition transitionKey={location.pathname}>
            {outlet}
          </PageTransition>
          <MilestoneCelebration roomId={activeRoom.id} />
        </DataProvider>
      )}
    </AppShell>
  );
}

/**
 * Watches the shared room totals (sum of every member's recorded
 * deposits vs sum of every member's target — matching the percent
 * shown in TotalVaultCard) and surfaces the one-shot
 * MilestoneCelebrationModal when a 25 / 50 / 75 / 90 threshold has
 * been crossed but not yet acknowledged for the current user.
 *
 * Lives inside DataProvider so it only mounts on room-bound routes
 * and gets realtime updates for free from useLeaderboard /
 * useMilestoneCrossings.
 */
function MilestoneCelebration({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const { leaderboard, goal } = useSharedData();
  const totalSaved = leaderboard.entries.reduce((sum, entry) => sum + entry.saved, 0);
  // Task 37: Vault denominator is the room goal. Fall back to summed
  // personal sub-goals only while `rooms.target_amount` is unbackfilled.
  const summedPersonal = leaderboard.entries.reduce(
    (sum, entry) => sum + (entry.personalGoalTarget ?? 0),
    0,
  );
  const totalTarget =
    goal.roomGoalTarget
    ?? (summedPersonal > 0 ? summedPersonal : (goal.personalGoalTarget ?? 0));
  const { pendingThreshold, acknowledge } = useMilestoneCrossings({
    roomId,
    userId: user?.id,
    totalSaved,
    target: totalTarget,
  });
  function handleAcknowledge() {
    void acknowledge();
  }
  return (
    <MilestoneCelebrationModal
      open={pendingThreshold !== null}
      threshold={pendingThreshold}
      onAcknowledge={handleAcknowledge}
    />
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
  onJoin,
}: {
  onJoin: ReturnType<typeof useRooms>['joinRoomByCode'];
}) {
  const navigate = useNavigate();
  const { copy } = useI18n();
  const ps = copy.projectSetup;
  const [mode, setMode] = useState<SetupMode>('create');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function handleJoin() {
    const result = await onJoin(code);
    if (result.error) setMessage(result.error);
    else if (result.roomId) {
      const params = new URLSearchParams({ roomId: result.roomId });
      if (result.joinStatus === 'rejoined') params.set('rejoin', 'true');
      navigate(`/join-room?${params.toString()}`);
    } else {
      navigate('/dashboard');
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-8">
      <header>
        <SectionLabel tone="brand">GO-OUT</SectionLabel>
        <h1 className="mt-2 font-mono text-3xl font-bold text-ink">{ps.title}</h1>
        <p className="mt-2 font-mono text-xs text-ink-muted">{ps.subtitle}</p>
      </header>

      {message && (
        <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>
      )}

      {mode === 'join' ? (
        <div className="flex flex-col gap-4">
          <JoinProjectFlow
            code={code}
            error={code.length > 0 && code.length < 6 ? ps.joinCodeValidation : undefined}
            preview={code.length >= 6 ? joinPreview(code, copy) : null}
            onCodeChange={setCode}
            onJoin={handleJoin}
          />
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setMessage(null);
            }}
            className="self-start font-mono text-xs font-bold text-ink-muted hover:text-ink"
          >
            ← {copy.common.back}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <SetupChoiceCard
            icon={<IconRocket size={22} />}
            title={ps.createCardTitle}
            body={ps.createCardBody}
            onClick={() => navigate('/create-room')}
          />
          <SetupChoiceCard
            icon={<IconUserPlus size={22} />}
            title={ps.joinCardTitle}
            body={ps.joinCardBody}
            onClick={() => setMode('join')}
          />
        </div>
      )}
    </div>
  );
}

function SetupChoiceCard({
  icon,
  title,
  body,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl bg-surface p-5 text-left shadow-soft transition-transform active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-base font-bold text-ink">{title}</span>
        <span className="mt-0.5 block font-mono text-xs leading-5 text-ink-muted">{body}</span>
      </span>
      <span className="flex-shrink-0 text-ink-dim transition-colors group-hover:text-brand-600">
        <IconChevronRight size={20} />
      </span>
    </button>
  );
}

function StatusCard({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center px-2 pb-16 pt-8">
      <section
        aria-live="assertive"
        className="w-full max-w-sm rounded-xl bg-surface p-5 text-center shadow-soft"
      >
        <SectionLabel tone="brand">GO-OUT</SectionLabel>
        <h1 className="mt-2 font-mono text-2xl font-bold leading-tight text-ink">{title}</h1>
        <p className="mt-2 font-mono text-xs leading-5 text-ink-muted">{body}</p>
        {actionLabel && onAction && (
          <Button className="mt-5" fullWidth onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </section>
    </div>
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

function joinPreview(code: string, copy: ReturnType<typeof useI18n>['copy']) {
  return {
    icon: <IconPlane size={32} />,
    name: copy.projectSetup.inviteName(code.toUpperCase()),
    creatorName: copy.projectSetup.projectOwner,
    creatorFallback: 'P',
  };
}
