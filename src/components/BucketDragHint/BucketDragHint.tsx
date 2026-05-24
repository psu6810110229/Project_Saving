import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconX } from '../Icon/Icon';

interface BucketDragHintProps {
  /** Whether the hint should render. The parent owns visibility gating
   *  (>= 2 own active buckets, not yet seen, own-bucket view active). */
  open: boolean;
  /** Body copy describing the gesture. Provided by the parent so the
   *  hint stays language-agnostic. */
  message: string;
  /** Accessible label for the close affordance. */
  dismissAriaLabel: string;
  /** Called the first time the hint becomes visible. Use this to
   *  persist the "seen" flag account-level so the hint never reopens. */
  onShown: () => void;
  /** Called when the user explicitly dismisses the hint. */
  onDismiss: () => void;
}

/**
 * One-time hint that teaches the bucket drag shortcut. Plan §13 / Slice 40.9:
 *   - shown only when useful (parent gates on bucket count + seen flag)
 *   - account-level persistence (parent marks seen)
 *   - subtle motion, never a modal tutorial
 *   - respects prefers-reduced-motion — no shimmer, immediate fade
 *   - auto-dismisses so it never blocks interaction
 */
export function BucketDragHint({
  open,
  message,
  dismissAriaLabel,
  onShown,
  onDismiss,
}: BucketDragHintProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    onShown();
  }, [open, onShown]);


  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduceMotion ? 0.15 : 0.22, ease: 'easeOut' }}
          className="flex items-center gap-3 rounded-2xl bg-brand-50 px-3 py-2 shadow-soft"
        >
          <motion.span
            aria-hidden
            initial={false}
            animate={reduceMotion ? undefined : { y: [0, -2, 0] }}
            transition={reduceMotion ? undefined : { duration: 1.6, repeat: 1, ease: 'easeInOut' }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-ink-inverse shadow-haloOrange"
          >
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6v12M16 6v12M3 12h18" />
            </svg>
          </motion.span>
          <p className="flex-1 font-mono text-xs leading-snug text-ink">{message}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissAriaLabel}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink active:scale-[0.98]"
          >
            <IconX size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
