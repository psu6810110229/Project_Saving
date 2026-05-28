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
  tint: CoverTint;
}

export const HERO_COVER_PRESETS: HeroCoverPreset[] = [
  { id: 'dusk', url: '/hero-covers/dusk.png', tint: { rgb: [40, 22, 14], strength: 0.55 } },
  { id: 'teal', url: '/hero-covers/teal.png', tint: { rgb: [10, 26, 30], strength: 0.55 } },
  { id: 'slate', url: '/hero-covers/slate.png', tint: { rgb: [20, 22, 26], strength: 0.5 } },
  { id: 'sunset', url: '/hero-covers/sunset.png', tint: { rgb: [36, 24, 30], strength: 0.6 } },
  { id: 'midnight', url: '/hero-covers/midnight.png', tint: { rgb: [12, 14, 24], strength: 0.6 } },
];
