import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../Avatar/Avatar';
import { AvatarUpload } from '../AvatarUpload/AvatarUpload';
import { IconArrowLeft, IconArrowRight, IconCheck, IconEdit } from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { TextInput } from '../TextInput/TextInput';
import { WizardProgress } from '../CreateRoomWizard/WizardProgress';
import type { ThemeSwatch } from '../../lib/theme';
import { MOTION_DURATION, MOTION_EASE, REDUCED_MOTION_TRANSITION } from '../../lib/motion';
import { ROOM_NAME_MAX_LENGTH } from '../../lib/roomName';
import { useI18n } from '../../i18n/useI18n';

type ProfileState = {
  profile: {
    display_name: string;
    avatar_url?: string | null;
    theme_color?: ThemeSwatch;
  } | null;
  themeColor: ThemeSwatch;
  updateProfile: (values: { display_name: string; theme_color: ThemeSwatch }) => Promise<{ error?: string }>;
  uploadAvatar: (file: File) => Promise<{ error?: string; url?: string }>;
  completeIdentitySetup: () => Promise<{ error?: string }>;
};

interface FirstRunProfileWizardProps {
  profileState: ProfileState;
}

const TOTAL_STEPS = 3;

export function FirstRunProfileWizard({ profileState }: FirstRunProfileWizardProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { copy, language, setLanguage } = useI18n();
  const c = copy.profileOnboarding;

  const displayName = profileState.profile?.display_name?.trim() ?? '';
  const fallback = displayName.charAt(0).toUpperCase() || 'G';

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const nameCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (step !== 1) return;

    const scrollActiveCardIntoView = () => {
      const target = nameCardRef.current;
      if (!target) return;
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      }, 120);
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
      scrollActiveCardIntoView();
    };

    const viewport = window.visualViewport;
    document.addEventListener('focusin', handleFocusIn);
    viewport?.addEventListener('resize', scrollActiveCardIntoView);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      viewport?.removeEventListener('resize', scrollActiveCardIntoView);
    };
  }, [reduceMotion, step]);

  useEffect(() => {
    if (language !== 'th') setLanguage('th');
  }, [language, setLanguage]);

  if (language !== 'th') return null;

  function goTo(nextStep: number) {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
    setMessage(null);
  }

  function handleBack() {
    if (step <= 1) return;
    goTo(step - 1);
  }

  async function handleAvatarUpload(file: File) {
    const result = await profileState.uploadAvatar(file);
    if (!result.error) return result;
    if (result.error === 'Please choose an image file.') {
      return { error: copy.sharedControls.imageTypeError };
    }
    if (result.error === 'Image must be smaller than 5 MB.') {
      return { error: copy.sharedControls.imageSizeError };
    }
    return result;
  }

  async function handleFinish() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setMessage(c.nameRequired);
      goTo(1);
      return;
    }

    setSaving(true);
    setMessage(null);
    const profileResult = await profileState.updateProfile({
      display_name: trimmed,
      theme_color: profileState.themeColor,
    });
    if (profileResult.error) {
      setSaving(false);
      setMessage(profileResult.error);
      return;
    }

    const completeResult = await profileState.completeIdentitySetup();
    setSaving(false);
    if (completeResult.error) {
      setMessage(completeResult.error);
      return;
    }

    navigate('/dashboard', { replace: true });
  }

  const canAdvance = step === 1 ? nameDraft.trim().length > 0 : !avatarBusy;
  const primaryLabel =
    step === 3 ? c.finishButton : step === 2 ? c.photoNextButton : c.nameNextButton;
  const stepCardClassName = 'mx-auto w-full max-w-md rounded-[28px] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.56)_0%,rgba(255,248,242,0.44)_100%)] px-5 py-7 shadow-[0_28px_68px_-30px_rgba(112,58,16,0.42),0_10px_24px_-18px_rgba(255,255,255,0.5)_inset] backdrop-blur-xl';
  const previewName = nameDraft.trim() || c.previewFallback;
  const previewNameClassName = previewName.length > 12
    ? 'font-mono text-[22px] font-bold leading-tight text-ink'
    : 'font-mono text-[28px] font-bold leading-tight text-ink';

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-bg">
      <AuroraBackdrop reduceMotion={Boolean(reduceMotion)} />

      <header className="sticky top-0 z-10 bg-bg/75 px-5 pb-3 pt-9 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1 || saving || avatarBusy}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-brand-50 hover:text-ink disabled:opacity-30"
              aria-label={copy.common.back}
            >
              <IconArrowLeft size={20} />
            </button>
            <SectionLabel tone="brand">{c.headerLabel}</SectionLabel>
          </div>
          <button
            type="button"
            onClick={() => {
              if (step === 3) {
                void handleFinish();
                return;
              }
              goTo(step + 1);
            }}
            disabled={saving || !canAdvance}
            className="inline-flex items-center gap-1 rounded-pill bg-brand-500 px-4 py-1.5 font-mono text-sm font-bold text-ink-inverse shadow-soft transition active:scale-95 disabled:opacity-40 disabled:active:scale-100"
          >
            {saving ? c.finishingButton : primaryLabel}
            {step === 3 ? <IconCheck size={16} /> : <IconArrowRight size={16} />}
          </button>
        </div>
        <div className="mt-3">
          <WizardProgress current={step} total={TOTAL_STEPS} />
        </div>
      </header>

      <main className="flex flex-1 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),2rem)] pt-4">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5">
          <motion.section
            className="flex min-h-[32rem] flex-col justify-center gap-5 py-4"
          >
              {step === 1 && (
                <>
                  <StepHeader title={c.nameTitle} />
                  <AnimatedStepCard
                    stepKey="name"
                    direction={direction}
                    reduceMotion={reduceMotion}
                    className={`${stepCardClassName} px-6 py-8`}
                    cardRef={nameCardRef}
                  >
                    <div className="flex flex-col items-center gap-5 text-center">
                      <div className="space-y-3">
                        <SectionLabel tone="brand" className="text-center">
                          {c.nameFieldLabel}
                        </SectionLabel>
                        <div className="rounded-[24px] bg-white/35 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_14px_28px_-20px_rgba(122,62,18,0.26)] backdrop-blur-md">
                          <p className={previewNameClassName}>
                            {previewName}
                          </p>
                        </div>
                      </div>

                      <div className="w-full space-y-2 text-left">
                        <div className="space-y-2">
                          <TextInput
                            value={nameDraft}
                            leadingIcon={<IconEdit size={16} />}
                            maxLength={ROOM_NAME_MAX_LENGTH}
                            onChange={event => setNameDraft(event.target.value.slice(0, ROOM_NAME_MAX_LENGTH))}
                            className="w-full border-brand-100/60 bg-white/25 px-4 py-3 shadow-none focus-within:bg-white/40"
                            autoFocus
                          />
                          <p className="text-right font-mono text-[11px] text-ink-dim">
                            {nameDraft.length}/{ROOM_NAME_MAX_LENGTH}
                          </p>
                        </div>
                      </div>
                    </div>
                  </AnimatedStepCard>
                </>
              )}

              {step === 2 && (
                <>
                  <StepHeader title={c.photoTitle} />
                  <AnimatedStepCard
                    stepKey="photo"
                    direction={direction}
                    reduceMotion={reduceMotion}
                    className={`${stepCardClassName} px-6 py-10`}
                  >
                    <div className="rounded-[24px] bg-white/30 px-5 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_16px_36px_-24px_rgba(122,62,18,0.28)] backdrop-blur-md">
                      <AvatarUpload
                        avatarUrl={profileState.profile?.avatar_url ?? null}
                        fallback={nameDraft.trim().charAt(0).toUpperCase() || fallback}
                        displayName={nameDraft.trim() || c.previewFallback}
                        onUpload={handleAvatarUpload}
                        disabled={saving}
                        onBusyChange={setAvatarBusy}
                        layout="stacked"
                        emphasis="hero"
                      />
                    </div>
                  </AnimatedStepCard>
                </>
              )}

              {step === 3 && (
                <>
                  <StepHeader title={c.reviewTitle} body={c.reviewBody} />
                  <AnimatedStepCard
                    stepKey="review"
                    direction={direction}
                    reduceMotion={reduceMotion}
                    className={stepCardClassName}
                  >
                    <div className="flex flex-col items-center gap-4 text-center">
                      <Avatar
                        imageUrl={profileState.profile?.avatar_url ?? null}
                        fallback={nameDraft.trim().charAt(0).toUpperCase() || fallback}
                        size="xl"
                        ring="theme"
                        themeColor={profileState.themeColor}
                      />
                      <div className="space-y-1">
                        <p className="font-mono text-lg font-bold text-ink">
                          {nameDraft.trim() || c.previewFallback}
                        </p>
                        <p className="font-mono text-xs text-ink-muted">
                          {c.reviewHint}
                        </p>
                      </div>
                    </div>
                  </AnimatedStepCard>
                </>
              )}
          </motion.section>
          {message && (
            <p className="rounded-xl bg-danger-soft px-4 py-3 font-mono text-xs text-danger">
              {message}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function StepHeader({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mx-auto w-full max-w-md pt-2 text-center">
      <h1 className="font-mono text-3xl font-bold leading-tight text-ink">{title}</h1>
      {body && <p className="mt-2 font-mono text-sm leading-6 text-ink-muted">{body}</p>}
    </div>
  );
}

function AnimatedStepCard({
  children,
  className,
  direction,
  reduceMotion,
  stepKey,
  cardRef,
}: {
  children: React.ReactNode;
  className: string;
  direction: number;
  reduceMotion: boolean | null;
  stepKey: string;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        ref={cardRef}
        key={stepKey}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? 36 : -36 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -24 : 24 }}
        transition={
          reduceMotion
            ? REDUCED_MOTION_TRANSITION
            : { duration: MOTION_DURATION.fade, ease: MOTION_EASE.emphasized }
        }
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function AuroraBackdrop({ reduceMotion }: { reduceMotion: boolean }) {
  const drift = (offsets: { x: number[]; y: number[] }, duration: number) =>
    reduceMotion
      ? undefined
      : {
          animate: { x: offsets.x, y: offsets.y },
          transition: { duration, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' as const },
        };

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        {...(drift({ x: [0, 30, 0], y: [0, -24, 0] }, 14) ?? {})}
        className="absolute -left-16 -top-10 h-72 w-72 rounded-full bg-brand-300/50 blur-3xl"
      />
      <motion.div
        {...(drift({ x: [0, -28, 0], y: [0, 26, 0] }, 18) ?? {})}
        className="absolute -bottom-16 -right-12 h-80 w-80 rounded-full bg-brand-200/60 blur-3xl"
      />
    </div>
  );
}
