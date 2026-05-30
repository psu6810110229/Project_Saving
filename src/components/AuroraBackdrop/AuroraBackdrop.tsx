import { motion } from 'framer-motion';

/**
 * Soft brand-tinted aurora behind a screen's content. Two large blurred blobs
 * drift slowly to give the surface some life; `prefers-reduced-motion` freezes
 * them in place. Renders as an `absolute inset-0` layer, so the parent must be
 * `relative` (and usually `overflow-hidden`) with content lifted via `z-10`.
 *
 * Shared between the login hero and the room wizards so the entry flows share
 * one backdrop treatment.
 */
export function AuroraBackdrop({ reduceMotion }: { reduceMotion: boolean }) {
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
        className="absolute -left-16 -top-10 h-72 w-72 rounded-full bg-brand-300/38 blur-3xl"
      />
      <motion.div
        {...(drift({ x: [0, -28, 0], y: [0, 26, 0] }, 18) ?? {})}
        className="absolute -bottom-16 -right-12 h-80 w-80 rounded-full bg-brand-200/45 blur-3xl"
      />
    </div>
  );
}
