export const MOTION_EASE = {
  standard: [0.4, 0, 0.2, 1],
  emphasized: [0.22, 1, 0.36, 1],
  quickOut: [0.36, 0, 0.66, -0.56],
} as const;

export const MOTION_DURATION = {
  page: 0.34,
  fade: 0.2,
  reduced: 0.15,
  micro: 0.08,
} as const;

export const PAGE_TRANSITION = {
  type: 'tween',
  ease: MOTION_EASE.emphasized,
  duration: MOTION_DURATION.page,
} as const;

export const FADE_TRANSITION = {
  duration: MOTION_DURATION.fade,
} as const;

export const REDUCED_MOTION_TRANSITION = {
  duration: MOTION_DURATION.reduced,
} as const;

export const SPRING = {
  tab: { type: 'spring', damping: 26, stiffness: 380 },
  modal: { type: 'spring', damping: 28, stiffness: 280 },
  sheet: { type: 'spring', damping: 30, stiffness: 300 },
  content: { type: 'spring', damping: 26, stiffness: 260 },
  outcome: { type: 'spring', damping: 26, stiffness: 280 },
  press: { type: 'spring', damping: 20, stiffness: 400, mass: 0.8 },
} as const;

export const MICRO_BOUNCE_TRANSITION = {
  duration: MOTION_DURATION.micro,
  ease: MOTION_EASE.quickOut,
} as const;
