import { motion, useReducedMotion } from 'framer-motion';
import { MOTION_EASE } from '../../lib/motion';

/**
 * Brand splash shown once on every app launch (while the bundle and auth
 * settle), then fades out. Mounted above everything in `App`; the fade-out
 * is driven by `AnimatePresence` there. Pre-i18n, so all copy is the
 * language-neutral brand lockup.
 */
export function SplashScreen() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: MOTION_EASE.standard }}
    >
      <motion.div
        className="flex items-center gap-3"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={
          reduceMotion
            ? { duration: 0.2 }
            : { duration: 0.55, ease: MOTION_EASE.emphasized }
        }
      >
        <span className="flex h-14 w-14 items-center justify-center">
          <img
            src="/icon-192.png"
            alt="GO-OUT"
            className="h-12 w-12"
          />
        </span>

        <span className="font-mono text-4xl font-bold tracking-tight text-brand-800">GO-OUT</span>
      </motion.div>

      <motion.span
        className="absolute bottom-12 font-mono text-[12px] font-bold uppercase tracking-[0.32em] text-ink-dim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.2 }}
      >
        Save together
      </motion.span>
    </motion.div>
  );
}
