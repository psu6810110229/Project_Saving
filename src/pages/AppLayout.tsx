import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { Fragment, type ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AboutInfo } from '../components/AboutInfo/AboutInfo';
import { AppShell } from '../components/AppShell/AppShell';
import { AuroraBackdrop } from '../components/AuroraBackdrop/AuroraBackdrop';
import { Avatar } from '../components/Avatar/Avatar';
import type { BottomNavTab } from '../components/BottomNav/BottomNav';
import { Button } from '../components/Button/Button';
import { DataProvider } from '../components/DataContext/DataContext';
import { FirstRunProfileWizard } from '../components/FirstRunProfileWizard/FirstRunProfileWizard';
import { InAppNotificationBridge } from '../components/InAppToast/InAppNotificationBridge';
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
  IconEdit,
  IconFlag,
  IconGear,
  IconPiggyBank,
  IconRocket,
  IconShield,
  IconUserPlus,
} from '../components/Icon/Icon';
import { IconButton } from '../components/IconButton/IconButton';
import { Modal } from '../components/Modal/Modal';
import { ProfileEditForm } from '../components/ProfileEditForm/ProfileEditForm';
import { MOTION_DURATION, MOTION_EASE, REDUCED_MOTION_TRANSITION } from '../lib/motion';
import { useAuth } from '../hooks/useAuth';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useMilestoneCrossings } from '../hooks/useMilestoneCrossings';
import { useRoom } from '../hooks/useRoom';
import { useRooms } from '../hooks/useRooms';
import type { RoomPreviewResult } from '../hooks/useRooms';
import { useProfile } from '../hooks/useProfile';
import { useSharedData } from '../hooks/useSharedData';
import { useWidgetSync } from '../hooks/useWidgetSync';
import { useI18n } from '../i18n/useI18n';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, isLanguage } from '../i18n/languages';

type SetupMode = 'create' | 'join';

// Temporarily hide the "see an example project" preview toggle on the setup
// screen. Flip back to true to restore it.
const SHOW_PROJECT_PREVIEW = false;
// First-run profile onboarding is only for accounts created after this
// feature shipped. Older accounts should continue straight to the
// welcome/setup screen even if their completion flag is missing.
const PROFILE_ONBOARDING_ROLLOUT_AT = Date.parse('2026-05-30T08:14:44.815Z');

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

function shouldShowFirstRunProfileWizard(profile: ReturnType<typeof useProfile>['profile']): boolean {
  if (!profile) return false;
  if (profile.identity_setup_completed_at) return false;

  const createdAt = Date.parse(profile.created_at);
  if (Number.isNaN(createdAt)) return false;
  return createdAt >= PROFILE_ONBOARDING_ROLLOUT_AT;
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeRoom } = useRoom();
  const { loading, error, refetch, joinRoomByCode, fetchRoomPreview } = useRooms();
  const profileState = useProfile();
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
  const isSetupScreen = !loading && !error && !activeRoom && !roomlessAllowed;
  // The create-room wizard is its own focused, multi-step flow with its own
  // header/back control — the bottom nav has no place there.
  const isCreateWizard = location.pathname.startsWith('/create-room');
  // Without an active room the bottom-nav tabs (Dashboard / Team / Profile)
  // have nothing to point at, so hide the nav across every no-room state —
  // the setup screen and the roomless routes reached from it (e.g. /profile
  // via the setup gear). Those pages provide their own back affordance.
  const noActiveRoom = !loading && !error && !activeRoom;
  const hideNav = noActiveRoom || isCreateWizard;
  const showReleaseModal = location.pathname === '/dashboard';
  const showingFirstRunProfileWizard = shouldShowFirstRunProfileWizard(profileState.profile);

  return (
    <AppShell
      activeTab={activeTab}
      showNav={!hideNav}
      showReleaseModal={showReleaseModal}
      onTabChange={tab => {
        const nextPath = pathFromTab(tab);
        if (nextPath === location.pathname) return;
        navigate(nextPath, { replace: true });
      }}
    >
      <InAppNotificationBridge />
      <ProfileLanguageSync
        profile={profileState.profile}
        forceLanguage={showingFirstRunProfileWizard ? 'th' : undefined}
      />
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
      {/* The create-room wizard renders in its own stable branch, independent
          of `activeRoom`. Creating the project flips `activeRoom` null→set
          mid-flow; without this, the outlet would jump between the no-room and
          active-room branches below and React would remount the wizard,
          destroying the StepSummary success/invite screen (the room is created
          but the UI never confirms it). Keeping one branch keeps it mounted. */}
      {!loading && !error && isCreateWizard && (
        <PageTransition transitionKey="/create-room">
          {outlet}
        </PageTransition>
      )}
      {!loading && !error && !activeRoom && !isCreateWizard && (
        // One PageTransition spans the no-room states (setup screen + roomless
        // routes like /create-room, /join-room) so navigating between them
        // animates instead of swapping separate transition instances.
        <PageTransition transitionKey={isSetupScreen ? 'project-setup' : location.pathname}>
          {profileState.loading ? (
            <div className="flex h-full items-center justify-center px-2 pb-16 pt-8">
              <LoadingState
                variant="card"
                label={copy.common.loadingProfile}
                title={copy.common.loadingProfile}
                body={copy.profileOnboarding.loadingBody}
                messages={copy.common.loadingMessages}
              />
            </div>
          ) : profileState.error ? (
            <StatusCard
              title={copy.profile.errorTitle}
              body={profileState.error}
              actionLabel={copy.common.retry}
              onAction={() => void profileState.refetch()}
            />
          ) : showingFirstRunProfileWizard ? (
            <FirstRunProfileWizard profileState={profileState} />
          ) : isSetupScreen ? (
            <ProjectSetup
              onJoin={joinRoomByCode}
              fetchPreview={fetchRoomPreview}
              profileState={profileState}
            />
          ) : (
            outlet
          )}
        </PageTransition>
      )}
      {!loading && !error && activeRoom && privateDataFree && !isCreateWizard && (
        <PageTransition transitionKey={location.pathname}>
          {outlet}
        </PageTransition>
      )}
      {!loading && !error && activeRoom && !privateDataFree && !isCreateWizard && (
        <DataProvider roomId={activeRoom.id}>
          <PageTransition transitionKey={location.pathname}>
            {outlet}
          </PageTransition>
          <MilestoneCelebration roomId={activeRoom.id} />
          <WidgetSync />
        </DataProvider>
      )}
    </AppShell>
  );
}

/**
 * Mirrors the dashboard's saved / goal / streak numbers into native storage
 * for the Android home-screen widget. Lives inside DataProvider so it has the
 * shared room data; renders nothing and is a no-op on the web.
 */
function WidgetSync() {
  useWidgetSync();
  return null;
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
 * Force Thai by default. Once the profile loads, adopt the user's
 * explicitly saved preference from Profile settings, if any.
 */
function ProfileLanguageSync({
  profile,
  forceLanguage,
}: {
  profile: ReturnType<typeof useProfile>['profile'];
  forceLanguage?: 'th';
}) {
  const { setLanguage } = useI18n();
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (!forceLanguage && isLanguage(stored)) return;
    } catch {
      // If storage is unavailable, profile remains the safest persisted source.
    }

    const next = forceLanguage ?? (isLanguage(profile?.ui_language) ? profile.ui_language : DEFAULT_LANGUAGE);
    setLanguage(next);
  }, [forceLanguage, profile?.ui_language, setLanguage]);
  return null;
}

function ProjectSetup({
  onJoin,
  fetchPreview,
  profileState,
}: {
  onJoin: ReturnType<typeof useRooms>['joinRoomByCode'];
  fetchPreview: ReturnType<typeof useRooms>['fetchRoomPreview'];
  profileState: ReturnType<typeof useProfile>;
}) {
  const navigate = useNavigate();
  const { copy } = useI18n();
  const { profile, themeColor, updateProfile, uploadAvatar } = profileState;
  const reduceMotion = useReducedMotion();
  const ps = copy.projectSetup;
  const pf = copy.profile;
  const displayName = profile?.display_name?.trim();
  const firstName = displayName ? displayName.split(/\s+/)[0] : undefined;
  // Cap the displayed name at 20 characters so the greeting stays tidy.
  const displayNameCapped = displayName
    ? displayName.length > 20
      ? `${displayName.slice(0, 20)}…`
      : displayName
    : undefined;
  const greeting = displayNameCapped ? ps.greeting(displayNameCapped) : ps.greetingNoName;
  // Inline profile edit (photo + name) so users can fix their identity before
  // a room exists — the setup screen is the only place reachable pre-room.
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName ?? '');
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

  async function handleAvatarUpload(file: File) {
    const result = await uploadAvatar(file);
    if (!result.error) return result;
    if (result.error === 'Please choose an image file.') {
      return { error: copy.sharedControls.imageTypeError };
    }
    if (result.error === 'Image must be smaller than 5 MB.') {
      return { error: copy.sharedControls.imageSizeError };
    }
    return result;
  }

  async function handleProfileSave() {
    const trimmed = nameDraft.trim();
    const result = await updateProfile({
      display_name: trimmed || (displayName ?? ''),
      theme_color: themeColor,
    });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setEditingProfile(false);
  }

  if (mode === 'join') {
    return (
      <div className="relative min-h-[100dvh] overflow-hidden bg-bg">
        <AuroraBackdrop
          reduceMotion={Boolean(reduceMotion)}
          contrast={0.8}
          palette={{
            primary: 'bg-brand-300/[0.34]',
            secondary: 'bg-brand-200/[0.4]',
            center: 'bg-brand-100/[0.18]',
            glow: 'bg-brand-400/[0.14]',
          }}
        />
        <motion.div
          key="setup-join"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={
            reduceMotion
              ? REDUCED_MOTION_TRANSITION
              : { duration: MOTION_DURATION.fade, ease: MOTION_EASE.emphasized }
          }
          className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col gap-6 px-5 pb-12 pt-8"
        >
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setMessage(null);
            }}
            aria-label={copy.common.back}
            className="self-start inline-flex items-center gap-2 rounded-pill px-4 py-2.5 font-mono text-base font-bold text-ink-muted transition-colors hover:bg-well hover:text-ink"
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
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-bg">
      <AuroraBackdrop
        reduceMotion={Boolean(reduceMotion)}
        contrast={0.8}
        palette={{
          primary: 'bg-brand-300/[0.34]',
          secondary: 'bg-brand-200/[0.4]',
          center: 'bg-brand-100/[0.18]',
          glow: 'bg-brand-400/[0.14]',
        }}
      />
      <motion.div
        key="setup-create"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -32 }}
        animate={{ opacity: 1, x: 0 }}
        transition={
          reduceMotion
            ? REDUCED_MOTION_TRANSITION
            : { duration: MOTION_DURATION.fade, ease: MOTION_EASE.emphasized }
        }
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col gap-6 px-5 pb-12 pt-6"
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
            <div className="mt-6 flex min-w-0 flex-1 items-center gap-3">
              <Avatar
                size="md"
                imageUrl={profile?.avatar_url}
                fallback={firstName?.charAt(0).toUpperCase() || 'G'}
                ring="theme"
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-brand-700">
                  GO-OUT
                </p>
                <div className="flex items-center gap-1.5">
                  <h1 className="whitespace-nowrap font-mono text-md font-bold leading-tight text-ink">{greeting}</h1>
                  <IconButton
                    ariaLabel={pf.editProfileModalTitle}
                    size="sm"
                    onClick={() => {
                      setNameDraft(displayName ?? '');
                      setMessage(null);
                      setEditingProfile(true);
                    }}
                    className="shrink-0"
                  >
                    <IconEdit size={16} />
                  </IconButton>
                </div>
              </div>
            </div>
            {/* The setup screen hides the bottom nav, so these are the only way
                to reach the about/terms info and settings / sign out before a
                room exists. */}
            <div className="flex shrink-0 items-center gap-2">
              <AboutInfo size="md" />
              <IconButton
                ariaLabel={ps.settingsAriaLabel}
                size="md"
                onClick={() => navigate('/profile')}
              >
                <IconGear size={20} />
              </IconButton>
            </div>
          </div>
        </motion.header>

        {message && (
          <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">{message}</p>
        )}

        <div>
          <SectionLabel tone="brand">{ps.getStartedLabel}</SectionLabel>
          <div className="mt-2 grid auto-rows-fr gap-3">
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
        </div>
        {SHOW_PROJECT_PREVIEW && (
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
        )}

        <div className="mt-auto flex flex-col gap-5 pt-4">
          <HowItWorks />

          <p className="flex items-center justify-center gap-2 px-2 text-center font-mono text-[11px] leading-5 text-ink-muted">
            <IconShield size={16} className="shrink-0 text-ink-dim" />
            {ps.trustLine}
          </p>
        </div>

        <Modal
          open={editingProfile}
          title={pf.editProfileModalTitle}
          onClose={() => setEditingProfile(false)}
          closeOnBackdrop={false}
          panelClassName="bg-bg/95 p-5 shadow-[0_24px_80px_-32px_rgba(42,26,14,0.45)] md:rounded-3xl"
          headerClassName="mb-5"
        >
          <ProfileEditForm
            avatarUrl={profile?.avatar_url ?? null}
            fallback={firstName?.charAt(0).toUpperCase() || 'G'}
            displayName={nameDraft}
            displayNameLabel={pf.displayNameLabel}
            saveLabel={pf.saveProfileButton}
            onAvatarUpload={handleAvatarUpload}
            onDisplayNameChange={setNameDraft}
            onSave={handleProfileSave}
          />
        </Modal>
      </motion.div>
    </div>
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
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-brand-700 backdrop-blur-md">
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
