import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../Button/Button';
import { IconCheck, IconRocket } from '../Icon/Icon';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useI18n } from '../../i18n/useI18n';
import { FADE_TRANSITION, SPRING } from '../../lib/motion';
import { subscribeAppUpdate } from '../../lib/pwaUpdate';

const RELEASE_UNDERSTOOD_KEY = 'releaseUnderstoodVersion';
const RELEASE_DISMISSED_KEY = 'releaseDismissedSessionVersion';
const FAKE_UPDATE_REFRESHED_KEY = 'fakeUpdateRefreshed';

type Phase = 'idle' | 'loading' | 'done';

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

    const duration = (3 + Math.random() * 7) * 1000;
    durationRef.current = duration;
    startTimeRef.current = performance.now();

    const totalMessages = messages.length;

    function tick(now: number) {
      const elapsed = now - startTimeRef.current;
      const ratio = Math.min(elapsed / durationRef.current, 1);

      const eased = ratio < 0.3
        ? ratio * 1.5
        : ratio < 0.8
          ? 0.45 + (ratio - 0.3) * 0.8
          : 0.85 + (ratio - 0.8) * 0.75;
      const pct = Math.min(Math.round(eased * 100), 100);
      setProgress(pct);

      const msgIdx = Math.min(
        Math.floor(ratio * totalMessages),
        totalMessages - 1,
      );
      setMessageIndex(msgIdx);

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
      window.sessionStorage.setItem(FAKE_UPDATE_REFRESHED_KEY, '1');
    } catch {
      // storage may be unavailable
    }
    window.location.reload();
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
