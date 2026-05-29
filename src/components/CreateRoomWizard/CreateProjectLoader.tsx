import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconRocket } from '../Icon/Icon';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useI18n } from '../../i18n/useI18n';
import { FADE_TRANSITION, SPRING } from '../../lib/motion';
import { buildProgressKeyframes, interpolateKeyframes } from '../../lib/fakeProgress';

interface CreateProjectLoaderProps {
  open: boolean;
  /** Fires once the progress animation reaches 100%. */
  onDone: () => void;
}

const DURATION = 4000;

/**
 * Full-screen "creating your project" loader with a realistic progress bar +
 * percentage, reusing the same fake-progress curve as the PWA update modal.
 * It always plays to 100% (~4s) and then calls `onDone`; the caller reveals
 * the result only once both the animation and the create request finish.
 *
 * The parent remounts this with a fresh `key` per attempt, so progress always
 * starts at 0 (no reset-in-effect needed).
 */
export function CreateProjectLoader({ open, onDone }: CreateProjectLoaderProps) {
  const { copy } = useI18n();
  const c = copy.createRoomWizard;
  const reduceMotion = useReducedMotion();
  const messages = c.creatingMessages;

  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const rafRef = useRef(0);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    const start = performance.now();
    const keyframes = buildProgressKeyframes();

    function tick(now: number) {
      const ratio = Math.min((now - start) / DURATION, 1);
      const pct = Math.min(Math.round(interpolateKeyframes(keyframes, ratio) * 100), 100);
      setProgress(pct);
      if (pct < 40) setMessageIndex(0);
      else if (pct < 80) setMessageIndex(Math.min(1, messages.length - 1));
      else setMessageIndex(Math.min(2, messages.length - 1));

      if (ratio < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [open, messages.length, onDone]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="create-loader-backdrop"
            className="fixed inset-0 z-[60] bg-ink/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE_TRANSITION}
          />
          <motion.div
            key="create-loader-card"
            className="fixed inset-0 z-[60] flex items-center justify-center px-4 pointer-events-none"
          >
            <motion.section
              role="alertdialog"
              aria-modal="true"
              aria-label={c.creatingTitle}
              className="relative pointer-events-auto w-full max-w-sm rounded-2xl bg-bg p-5 shadow-neuRaised"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={SPRING.modal}
            >
              <div className="flex flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-800 shadow-soft">
                  <IconRocket size={22} />
                </span>
                <h2 className="mt-3 font-mono text-lg font-bold text-ink">{c.creatingTitle}</h2>

                <div className="mt-5 w-full">
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-brand-100">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-brand-600"
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'linear' }}
                    />
                  </div>
                  <p className="mt-2 font-mono text-sm font-bold tabular-nums text-brand-800">
                    {progress}%
                  </p>
                </div>

                <p className="mt-2 font-mono text-xs text-ink-muted">{messages[messageIndex]}</p>
              </div>
            </motion.section>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
