import { motion } from 'framer-motion';

type AuroraBackdropProps = {
  contrast?: number;
  live?: boolean;
  motionSpeed?: number;
  palette?: {
    center?: string;
    glow?: string;
    primary?: string;
    secondary?: string;
  };
  reduceMotion: boolean;
  scatter?: boolean;
};

/**
 * Soft brand-tinted aurora behind a screen's content. Two large blurred blobs
 * can drift slowly to give the surface some life; `prefers-reduced-motion`
 * freezes them in place. Renders as an `absolute inset-0` layer, so the parent
 * must be `relative` (and usually `overflow-hidden`) with content lifted via
 * `z-10`.
 *
 * Shared between the login hero and the room wizards so the entry flows share
 * one backdrop treatment. Motion is opt-in so login can feel alive without
 * adding background movement to the rest of the app.
 */
export function AuroraBackdrop({
  contrast = 1,
  live = false,
  motionSpeed = 1,
  palette,
  reduceMotion,
  scatter = false,
}: AuroraBackdropProps) {
  const animateAurora = false;
  const saturationScale = 1;
  const opacityScale = 1;
  const drift = (offsets: { x: number[]; y: number[] }, duration: number) =>
    reduceMotion || !live || !animateAurora
      ? undefined
      : {
          animate: { x: offsets.x, y: offsets.y },
          transition: {
            duration: duration / motionSpeed,
            repeat: Infinity,
            repeatType: 'mirror' as const,
            ease: 'easeInOut' as const,
          },
        };
  const auraFilter = `blur(64px) saturate(${1 + ((contrast - 1) * 0.45 * saturationScale)}) contrast(${contrast})`;
  const primaryClass = palette?.primary ?? 'bg-brand-300/[0.46]';
  const secondaryClass = palette?.secondary ?? 'bg-brand-200/[0.54]';
  const centerClass = palette?.center ?? 'bg-brand-100/[0.26]';
  const glowClass = palette?.glow ?? 'bg-brand-400/[0.18]';
  const blooms = [
    {
      className: `absolute -left-24 -top-20 h-72 w-72 rounded-full ${primaryClass}`,
      duration: 9,
      delay: 0,
      x: [0, 30, -12, 0],
      y: [0, -26, 18, 0],
      opacity: [0.15, 0.58, 0.24, 0.15].map((value) => value * opacityScale),
      scale: [0.82, 1.08, 0.92, 0.82],
      filter: auraFilter,
    },
    {
      className: `absolute right-[8%] top-[12%] h-64 w-64 rounded-full ${glowClass}`,
      duration: 11,
      delay: 1.2,
      x: [0, -16, 12, 0],
      y: [0, 20, -12, 0],
      opacity: [0.08, 0.4, 0.18, 0.08].map((value) => value * opacityScale),
      scale: [0.74, 1.02, 0.86, 0.74],
      filter: `blur(76px) saturate(${1 + ((1.05 - 1) * saturationScale)})`,
    },
    {
      className: `absolute left-[12%] top-[42%] h-60 w-60 rounded-full ${centerClass}`,
      duration: 10,
      delay: 2.8,
      x: [0, 22, -10, 0],
      y: [0, -18, 14, 0],
      opacity: [0.04, 0.34, 0.12, 0.04].map((value) => value * opacityScale),
      scale: [0.68, 0.98, 0.82, 0.68],
      filter: `blur(82px) saturate(${1 + ((1.08 - 1) * saturationScale)})`,
    },
    {
      className: `absolute left-1/2 top-[28%] h-72 w-72 -translate-x-1/2 rounded-full ${secondaryClass}`,
      duration: 12,
      delay: 0.6,
      x: [0, -18, 14, 0],
      y: [0, 24, -16, 0],
      opacity: [0.1, 0.42, 0.18, 0.1].map((value) => value * opacityScale),
      scale: [0.76, 1.06, 0.9, 0.76],
      filter: auraFilter,
    },
    {
      className: `absolute right-[14%] top-[54%] h-80 w-80 rounded-full ${primaryClass}`,
      duration: 13,
      delay: 3.2,
      x: [0, 20, -24, 0],
      y: [0, -14, 20, 0],
      opacity: [0.06, 0.32, 0.14, 0.06].map((value) => value * opacityScale),
      scale: [0.7, 1, 0.84, 0.7],
      filter: auraFilter,
    },
    {
      className: `absolute -bottom-24 right-[4%] h-[22rem] w-[22rem] rounded-full ${secondaryClass}`,
      duration: 9.5,
      delay: 1.8,
      x: [0, -28, 10, 0],
      y: [0, 12, -22, 0],
      opacity: [0.12, 0.5, 0.22, 0.12].map((value) => value * opacityScale),
      scale: [0.8, 1.1, 0.94, 0.8],
      filter: auraFilter,
    },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {scatter
        ? blooms.map((bloom, index) => (
            <motion.div
              key={index}
              className={bloom.className}
              initial={reduceMotion ? { opacity: 0.2, scale: 0.92 } : undefined}
              animate={
                reduceMotion || !live || !animateAurora
                  ? undefined
                  : {
                      x: bloom.x,
                      y: bloom.y,
                      opacity: bloom.opacity,
                      scale: bloom.scale,
                    }
              }
              transition={
                reduceMotion || !live || !animateAurora
                  ? undefined
                  : {
                      duration: bloom.duration / motionSpeed,
                      delay: bloom.delay / motionSpeed,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      times: [0, 0.32, 0.68, 1],
                    }
              }
              style={{ filter: bloom.filter }}
            />
          ))
        : (
          <>
            <motion.div
              {...(drift({ x: [0, 30, 0], y: [0, -24, 0] }, 14) ?? {})}
              className={`absolute -left-20 -top-14 h-80 w-80 rounded-full ${primaryClass}`}
              style={{ filter: auraFilter }}
            />
            <motion.div
              {...(drift({ x: [0, -28, 0], y: [0, 26, 0] }, 18) ?? {})}
              className={`absolute -bottom-20 -right-16 h-[23rem] w-[23rem] rounded-full ${secondaryClass}`}
              style={{ filter: auraFilter }}
            />
            <motion.div
              {...(drift({ x: [0, 10, 0], y: [0, 18, 0] }, 22) ?? {})}
              className={`absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full ${centerClass}`}
              style={{ filter: `blur(82px) saturate(${1 + ((1.08 - 1) * saturationScale)})` }}
            />
          </>
        )}
    </div>
  );
}
