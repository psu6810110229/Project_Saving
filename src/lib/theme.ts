/**
 * Theme tokens mirrored from `tailwind.config.js`.
 *
 * Tailwind utilities are the primary way to apply these tokens in JSX.
 * This module exists so non-Tailwind code (SVG charts, dynamic
 * inline styles, canvas drawing) can read the same values without
 * hard-coding hex strings in multiple places.
 *
 * Keep this file in sync with `tailwind.config.js` — if a token changes
 * in one place, update both.
 */

export const palette = {
  bg:         '#FBF6F0',
  surface:    '#FFFFFF',
  surfaceAlt: '#FDF2E9',
  well:       '#F1E7DC',

  ink:        '#2A1A0E',
  inkMuted:   '#7A6A5E',
  inkDim:     '#B5A496',
  inkInverse: '#FFFFFF',

  brand50:  '#FDF2E9',
  brand100: '#FAD9BD',
  brand200: '#F4B98A',
  brand300: '#ED9659',
  brand400: '#E08246',
  brand500: '#F26B1A',
  brand600: '#D4651A',
  brand700: '#B85614',
  brand800: '#8E3F0D',
  brand900: '#5C2807',

  accentGold:  '#C99B3E',
  accentLeaf:  '#7A8C5A',
  accentSlate: '#5C6B7A',
  accentTeal:  '#2EA079',

  danger:     '#B3331E',
  dangerSoft: '#FBE3DF',
} as const;

export type PaletteToken = keyof typeof palette;

/**
 * Personal theme color swatches selectable from Profile → Theme Colors.
 * Each user's choice is persisted on `profiles.theme_color` (added in
 * migration 0009). Renders rings, progress bars, and accent text.
 */
export const themeSwatches = {
  terracotta: palette.brand500,
  slate:      palette.accentSlate,
  teal:       palette.accentTeal,
} as const;

export type ThemeSwatch = keyof typeof themeSwatches;

export const DEFAULT_THEME: ThemeSwatch = 'terracotta';

/** Pixel radii used by `<svg>` and dynamic styles. Mirror Tailwind `borderRadius`. */
export const radius = {
  lg:   14,
  xl:   20,
  '2xl':24,
  '3xl':32,
} as const;
