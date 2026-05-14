import { appVersion } from './version';

export interface ReleaseNote {
  id: string;
  title: string;
  body: string;
}

export interface ReleaseNotes {
  version: string;
  heading: string;
  intro: string;
  notes: ReleaseNote[];
}

export function currentReleaseNotes(): ReleaseNotes {
  return {
    version: appVersion(),
    heading: 'GO-OUT v0.9.2',
    intro: 'Smoother motion across the whole app.',
    notes: [
      {
        id: 'spring-motion',
        title: 'Spring physics everywhere',
        body: 'Modals, outcome screens, page transitions, and the bottom tab bar all use real spring animations — consistent with the bucket sheet.',
      },
      {
        id: 'tab-slide',
        title: 'Sliding tab indicator',
        body: 'Switching tabs now smoothly slides the active pill between icons instead of swapping instantly.',
      },
      {
        id: 'blur-backdrop',
        title: 'Blur backdrops',
        body: 'Modals and outcome overlays blur the content behind them for a more layered, immersive feel.',
      },
    ],
  };
}
