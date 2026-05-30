import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { Fragment, type ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AppShell } from '../components/AppShell/AppShell';
import { Avatar } from '../components/Avatar/Avatar';
import type { BottomNavTab } from '../components/BottomNav/BottomNav';
import { Button } from '../components/Button/Button';
import { DataProvider } from '../components/DataContext/DataContext';
import { JoinProjectFlow } from '../components/JoinProjectFlow/JoinProjectFlow';
import { LoadingState } from '../components/LoadingState/LoadingState';
import { MilestoneCelebrationModal } from '../components/MilestoneCelebrationModal/MilestoneCelebrationModal';
import { PageTransition } from '../components/PageTransition/PageTransition';
import { ProjectSetupShowcase } from '../components/ProjectSetupShowcase/ProjectSetupShowcase';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronRight,
  IconFlag,
  IconGear,
  IconPiggyBank,
  IconRocket,
  IconShield,
  IconUserPlus,
} from '../components/Icon/Icon';
import { IconButton } from '../components/IconButton/IconButton';
import { MOTION_DURATION, MOTION_EASE, REDUCED_MOTION_TRANSITION } from '../lib/motion';
import { useAuth } from '../hooks/useAuth';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useMilestoneCrossings } from '../hooks/useMilestoneCrossings';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import type { RoomPreviewResult } from '../hooks/useRooms';
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
  const { loading, error, refetch, joinRoomByCode, fetchRoomPreview } = useRooms();
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
  // The dedicated no-project setup view is full-screen onboarding — hide the
  // bottom nav there (there is no room to deposit into or dashboard to show).
  // Nav stays visible while loading/erroring, on roomless routes, and whenever
  // a room exists.
  const isSetupScreen = !loading && !error && !activeRoom && !roomlessAllowed;
  // The create-room wizard is its own focused, multi-step flow with its own
  // header/back control — the bottom nav has no place there.
  const isCreateWizard = location.pathname.startsWith('/create-room');
  const hideNav = isSetupScreen || isCreateWizard;

  return (
    <AppShell
      activeTab={activeTab}
      showNav={!hideNav}
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
      {!loading && !error && !activeRoom && (
        // One PageTransition spans the no-room states (setup screen + roomless
        // routes like /create-room, /join-room) so navigating between them
        // animates instead of swapping separate transition instances.
        <PageTransition transitionKey={isSetupScreen ? 'project-setup' : location.pathname}>
          {isSetupScreen ? (
            <ProjectSetup onJoin={joinRoomByCode} fetchPreview={fetchRoomPreview} />
          ) : (
            outlet
          )}
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
  fetchPreview,
}: {
  onJoin: ReturnType<typeof useRooms>['joinRoomByCode'];
  fetchPreview: ReturnType<typeof useRooms>['fetchRoomPreview'];
}) {
  const navigate = useNavigate();
  const { copy } = useI18n();
  const { profile } = useProfile();
  const reduceMotion = useReducedMotion();
  const ps = copy.projectSetup;
  const displayName = profile?.display_name?.trim();
  // Greet by first name only — full display names overflow the heading.
  const firstName = displayName ? displayName.split(/\s+/)[0] : undefined;
  const greeting = firstName ? ps.greeting(firstName) : ps.greetingNoName;
  const [mode, setMode] = useState<SetupMode>('create');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<RoomPreviewResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch the real room behind a completed code (debounced). The
  // preview card and Join button both read from this single source.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = code.length < 6 ? null : await fetchPreview(code);
      if (!cancelled) setPreview(result);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, fetchPreview]);

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

  if (mode === 'join') {
    return (
      <motion.div
        key="setup-join"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        transition={
          reduceMotion
            ? REDUCED_MOTION_TRANSITION
            : { duration: MOTION_DURATION.fade, ease: MOTION_EASE.emphasized }
        }
        className="flex flex-col gap-6 px-2 pt-8 pb-12"
      >
        <button
          type="button"
          onClick={() => {
            setMode('create');
            setMessage(null);
          }}
          aria-label={copy.common.back}
          className="self-start -ml-2 inline-flex items-center gap-2 rounded-pill px-4 py-2.5 font-mono text-base font-bold text-ink-muted hover:text-ink hover:bg-well transition-colors"
        >
          <IconArrowLeft size={24} />
          {copy.common.back}
        </button>
        <header>
          <SectionLabel tone="brand">GO-OUT</SectionLabel>
          <h1 className="mt-2 font-mono text-3xl font-bold text-ink">{ps.joinCardTitle}</h1>
          <p className="mt-2 font-mono text-xs text-ink-muted">{ps.joinCardBody}</p>
        </header>

        {message && (
          <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>
        )}

        <div className="flex flex-col gap-4">
          <JoinProjectFlow
            code={code}
            error={code.length > 0 && code.length < 6 ? ps.joinCodeValidation : undefined}
            preview={code.length >= 6 ? preview : null}
            onCodeChange={setCode}
            onJoin={handleJoin}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="setup-create"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={
        reduceMotion
          ? REDUCED_MOTION_TRANSITION
          : { duration: MOTION_DURATION.fade, ease: MOTION_EASE.emphasized }
      }
      className="flex flex-col gap-6 px-2 pt-6 pb-12"
    >
      <motion.header
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduceMotion
            ? REDUCED_MOTION_TRANSITION
            : { duration: MOTION_DURATION.page, ease: MOTION_EASE.emphasized }
        }
        className="pt-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              size="md"
              imageUrl={profile?.avatar_url}
              fallback={firstName?.charAt(0).toUpperCase() || 'G'}
              ring="theme"
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-brand-700">
                GO-OUT
              </p>
              <h1 className="truncate font-mono text-2xl font-bold leading-tight text-ink">{greeting}</h1>
            </div>
          </div>
          {/* The setup screen hides the bottom nav, so this is the only way to
              reach settings / sign out before a room exists. */}
          <IconButton
            ariaLabel={ps.settingsAriaLabel}
            size="md"
            onClick={() => navigate('/profile')}
            className="shrink-0"
          >
            <IconGear size={20} />
          </IconButton>
        </div>
        <p className="mt-3 font-mono text-sm leading-5 text-ink-muted">{ps.tagline}</p>
      </motion.header>

      {message && (
        <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>
      )}

      <div className="grid auto-rows-fr gap-3">
        <SetupChoiceCard
          emphasis
          icon={<IconUserPlus size={22} />}
          title={ps.joinCardTitle}
          body={ps.joinCardBody}
          onClick={() => setMode('join')}
        />
        <SetupChoiceCard
          icon={<IconRocket size={22} />}
          title={ps.createCardTitle}
          body={ps.createCardBody}
          onClick={() => navigate('/create-room')}
        />
      </div>

      <HowItWorks />

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          aria-expanded={showPreview}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-surface px-4 py-3 font-mono text-xs font-bold text-ink-muted shadow-soft hover:text-ink"
        >
          {showPreview ? ps.previewHide : ps.previewShow}
          <motion.span
            aria-hidden
            className="inline-flex"
            animate={{ rotate: showPreview ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: MOTION_DURATION.fade, ease: MOTION_EASE.emphasized }}
          >
            <IconChevronDown size={16} />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {showPreview && (
            <motion.div
              key="preview"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={
                reduceMotion
                  ? REDUCED_MOTION_TRANSITION
                  : { duration: MOTION_DURATION.fade, ease: MOTION_EASE.emphasized }
              }
              className="overflow-hidden"
            >
              <ProjectSetupShowcase />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="flex items-center justify-center gap-2 px-2 text-center font-mono text-[11px] leading-5 text-ink-muted">
        <IconShield size={16} className="shrink-0 text-ink-dim" />
        {ps.trustLine}
      </p>
    </motion.div>
  );
}

function HowItWorks() {
  const { copy } = useI18n();
  const ps = copy.projectSetup;
  const steps = [
    { icon: <IconUserPlus size={18} />, label: ps.step1 },
    { icon: <IconFlag size={18} />, label: ps.step2 },
    { icon: <IconPiggyBank size={18} />, label: ps.step3 },
  ];
  return (
    <div>
      <SectionLabel tone="brand">{ps.howItWorksLabel}</SectionLabel>
      <div className="mt-2 flex items-center gap-1.5">
        {steps.map((step, i) => (
          <Fragment key={i}>
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                {step.icon}
              </span>
              <span className="font-mono text-xs font-bold leading-tight text-ink">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <span aria-hidden className="shrink-0 text-ink-dim">
                <IconChevronRight size={16} />
              </span>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function SetupChoiceCard({
  icon,
  title,
  body,
  onClick,
  emphasis = false,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  emphasis?: boolean;
}) {
  // Both cards are white; the emphasised (Join) card keeps a subtle brand ring
  // so it still reads as the primary action without an orange fill.
  const containerClasses = emphasis
    ? 'group flex h-full w-full items-center gap-4 rounded-2xl bg-surface p-5 text-left shadow-soft ring-2 ring-brand-200 transition-transform active:scale-[0.99]'
    : 'group flex h-full w-full items-center gap-4 rounded-2xl bg-surface p-5 text-left shadow-soft transition-transform active:scale-[0.99]';
  const iconClasses = 'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700';
  const titleClasses = 'block font-mono text-base font-bold text-ink';
  const bodyClasses = 'mt-0.5 block font-mono text-xs leading-5 text-ink-muted';
  const chevronClasses = 'flex-shrink-0 text-ink-dim transition-colors group-hover:text-brand-600';

  return (
    <button type="button" onClick={onClick} className={containerClasses}>
      <span className={iconClasses}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={titleClasses}>{title}</span>
        <span className={bodyClasses}>{body}</span>
      </span>
      <span className={chevronClasses}>
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
  if (pathname.startsWith('/team')) return 'team';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'dashboard';
}

function pathFromTab(tab: BottomNavTab): string {
  if (tab === 'team') return '/team';
  if (tab === 'profile') return '/profile';
  return '/dashboard';
}
