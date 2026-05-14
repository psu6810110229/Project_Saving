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
    heading: 'GO-OUT v0.9.1',
    intro: 'UI polish and cleaner dashboard insights.',
    notes: [
      {
        id: 'daily-avg',
        title: 'Daily average needed',
        body: 'Recorded Vault now shows how much you need to deposit per day to reach your goal on time.',
      },
      {
        id: 'momentum-chart',
        title: 'Momentum chart improvements',
        body: 'Y-axis labels, bar value labels, and a dynamic scale make deposit trends easier to read.',
      },
      {
        id: 'card-polish',
        title: 'Cleaner card design',
        body: 'Cards use consistent backgrounds, Apple-style rounded corners, and flat dividers instead of nested boxes.',
      },
      {
        id: 'saving-plan-core',
        title: 'Saving Plan (v0.9.0)',
        body: 'Tracks expected daily progress and compares it with your recorded deposits.',
      },
      {
        id: 'check-balance',
        title: 'Check Balance (v0.9.0)',
        body: 'Compares your app balance with your real money and records a checkpoint when they match.',
      },
    ],
  };
}
