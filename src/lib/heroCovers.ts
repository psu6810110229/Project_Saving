import type { CoverTint } from '../types';

/**
 * App-provided hero cover styles. Each member can pick one of these instead
 * of uploading their own image. Images are static assets under
 * `public/hero-covers/`, so `url` is a same-origin path usable directly in a
 * CSS `url()`. `tint` is hand-tuned per style (a deep shade of the image
 * palette + scrim strength) so presets get the same readability treatment as
 * sampled uploads on the dashboard hero card.
 */
export interface HeroCoverPreset {
  id: string;
  url: string;
  legacyUrl?: string;
  tint: CoverTint;
}

export const HERO_COVER_PRESETS: HeroCoverPreset[] = [
  { id: 'dusk', url: '/hero-covers/dusk.jpg', legacyUrl: '/hero-covers/dusk.png', tint: { rgb: [40, 22, 14], strength: 0.55 } },
  { id: 'teal', url: '/hero-covers/teal.jpg', legacyUrl: '/hero-covers/teal.png', tint: { rgb: [10, 26, 30], strength: 0.55 } },
  { id: 'slate', url: '/hero-covers/slate.jpg', legacyUrl: '/hero-covers/slate.png', tint: { rgb: [20, 22, 26], strength: 0.5 } },
  { id: 'sunset', url: '/hero-covers/sunset.jpg', legacyUrl: '/hero-covers/sunset.png', tint: { rgb: [36, 24, 30], strength: 0.6 } },
  { id: 'midnight', url: '/hero-covers/midnight.jpg', legacyUrl: '/hero-covers/midnight.png', tint: { rgb: [12, 14, 24], strength: 0.6 } },
  { id: 'emerald', url: '/hero-covers/emerald.jpg', legacyUrl: '/hero-covers/emerald.png', tint: { rgb: [10, 30, 20], strength: 0.55 } },
  { id: 'plum', url: '/hero-covers/plum.jpg', legacyUrl: '/hero-covers/plum.png', tint: { rgb: [30, 14, 26], strength: 0.6 } },
  { id: 'carbon', url: '/hero-covers/carbon.jpg', legacyUrl: '/hero-covers/carbon.png', tint: { rgb: [16, 16, 18], strength: 0.5 } },
  { id: 'aurora', url: '/hero-covers/aurora.jpg', legacyUrl: '/hero-covers/aurora.png', tint: { rgb: [14, 18, 30], strength: 0.6 } },
  { id: 'dune', url: '/hero-covers/dune.jpg', legacyUrl: '/hero-covers/dune.png', tint: { rgb: [34, 26, 28], strength: 0.55 } },
];

function localPath(value: string): string {
  try {
    return new URL(value, 'https://go-out.local').pathname;
  } catch {
    return value.split(/[?#]/)[0];
  }
}

export function findHeroCoverPresetByUrl(url: string | null | undefined): HeroCoverPreset | undefined {
  if (!url) return undefined;
  const path = localPath(url);
  return HERO_COVER_PRESETS.find(preset => path === preset.url || path === preset.legacyUrl);
}

export function normalizeHeroCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return findHeroCoverPresetByUrl(url)?.url ?? url;
}
