import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../Button/Button';
import { IconCheck, IconRocket } from '../Icon/Icon';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useI18n } from '../../i18n/useI18n';
import { FADE_TRANSITION, SPRING } from '../../lib/motion';
import { applyAppUpdate, subscribeAppUpdate } from '../../lib/pwaUpdate';

const RELEASE_UNDERSTOOD_KEY = 'releaseUnderstoodVersion';
const RELEASE_DISMISSED_KEY = 'releaseDismissedSessionVersion';

type Phase = 'idle' | 'loading' | 'done';

type Keyframe = { t: number; v: number };

function buildProgressKeyframes(): Keyframe[] {
  const r = () => Math.random();
  return [
    { t: 0, v: 0 },
    { t: 0.08 + r() * 0.04, v: 0.12 + r() * 0.06 },
    { t: 0.22 + r() * 0.04, v: 0.25 + r() * 0.05 },
    { t: 0.35 + r() * 0.05, v: 0.28 + r() * 0.04 },
    { t: 0.50 + r() * 0.05, v: 0.50 + r() * 0.08 },
    { t: 0.65 + r() * 0.04, v: 0.55 + r() * 0.05 },
    { t: 0.78 + r() * 0.04, v: 0.75 + r() * 0.08 },
    { t: 0.90 + r() * 0.03, v: 0.88 + r() * 0.05 },
    { t: 1, v: 1 },
  ];
}

function interpolateKeyframes(kf: Keyframe[], t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let i = 0;
  while (i < kf.length - 1 && kf[i + 1].t <= t) i++;
  const a = kf[i];
  const b = kf[i + 1];
  const local = (t - a.t) / (b.t - a.t);
  return a.v + (b.v - a.v) * local;
}

export function AppUpdateAvailableModal() {
  const { copy } = useI18n();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const durationRef = useRef(0);

  useBodyScrollLock(open);

  useEffect(() => subscribeAppUpdate(() => setOpen(true)), []);

  const messages = copy.appUpdate.progressMessages as unknown as readonly string[];

  const startFakeLoading = useCallback(() => {
    setPhase('loading');
    setProgress(0);
    setMessageIndex(0);

    const DURATION = 5000;
    durationRef.current = DURATION;
    startTimeRef.current = performance.now();

    const keyframes = buildProgressKeyframes();

    function tick(now: number) {
      const elapsed = now - startTimeRef.current;
      const ratio = Math.min(elapsed / DURATION, 1);

      const pct = Math.min(Math.round(interpolateKeyframes(keyframes, ratio) * 100), 100);
      setProgress(pct);

      if (pct < 40) setMessageIndex(0);
      else if (pct < 80) setMessageIndex(Math.min(1, messages.length - 1));
      else setMessageIndex(Math.min(2, messages.length - 1));

      if (ratio < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPhase('done');
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function handleDone() {
    try {
      window.localStorage.removeItem(RELEASE_UNDERSTOOD_KEY);
      window.sessionStorage.removeItem(RELEASE_DISMISSED_KEY);
    } catch {
      // storage may be unavailable
    }
    setOpen(false);
    applyAppUpdate().then(() => {
      setTimeout(() => window.location.reload(), 800);
    });
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="app-update-backdrop"
            className="fixed inset-0 z-[60] bg-ink/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE_TRANSITION}
          />
          <motion.div
            key="app-update-card"
            className="fixed inset-0 z-[60] flex items-center justify-center px-4 pointer-events-none"
          >
            <motion.section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="app-update-title"
              aria-describedby="app-update-body"
              className="relative pointer-events-auto w-full max-w-sm rounded-2xl bg-bg p-5 shadow-neuRaised"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={SPRING.modal}
            >
              {phase === 'idle' && (
                <div className="flex flex-col items-center text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-800 shadow-soft">
                    <IconRocket size={22} />
                  </span>
                  <h2
                    id="app-update-title"
                    className="mt-3 font-mono text-lg font-bold text-ink"
                  >
                    {copy.appUpdate.title}
                  </h2>
                  <p
                    id="app-update-body"
                    className="mt-2 font-mono text-xs leading-5 text-ink-muted"
                  >
                    {copy.appUpdate.body}
                  </p>
                  <div className="mt-5 w-full">
                    <Button variant="action" fullWidth onClick={startFakeLoading}>
                      {copy.appUpdate.updateNow}
                    </Button>
                  </div>
                </div>
              )}

              {phase === 'loading' && (
                <div className="flex flex-col items-center text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-800 shadow-soft">
                    <IconRocket size={22} />
                  </span>
                  <h2 className="mt-3 font-mono text-lg font-bold text-ink">
                    {copy.appUpdate.updatingTitle}
                  </h2>

                  <div className="mt-5 w-full">
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-brand-100">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-brand-600"
                        initial={{ width: '0%' }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.15, ease: 'linear' }}
                      />
                    </div>
                    <p className="mt-2 font-mono text-sm font-bold tabular-nums text-brand-800">
                      {progress}%
                    </p>
                  </div>

                  <p className="mt-2 font-mono text-xs text-ink-muted">
                    {messages[messageIndex]}
                  </p>
                </div>
              )}

              {phase === 'done' && (
                <div className="flex flex-col items-center text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-700 shadow-soft">
                    <IconCheck size={22} />
                  </span>
                  <h2 className="mt-3 font-mono text-lg font-bold text-ink">
                    {copy.appUpdate.updateComplete}
                  </h2>

                  <div className="mt-5 w-full">
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-brand-100">
                      <div className="absolute inset-y-0 left-0 w-full rounded-full bg-green-500" />
                    </div>
                    <p className="mt-2 font-mono text-sm font-bold tabular-nums text-green-700">
                      100%
                    </p>
                  </div>

                  <div className="mt-5 w-full">
                    <Button variant="action" fullWidth onClick={handleDone}>
                      {copy.appUpdate.done}
                    </Button>
                  </div>
                </div>
              )}
            </motion.section>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
