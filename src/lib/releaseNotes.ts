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
    heading: 'GO-OUT v0.9.3',
    intro: 'Clearer progress at a glance.',
    notes: [
      {
        id: 'live-pct',
        title: 'Live progress percentage',
        body: 'The vault and each player\'s row now show a percentage that updates in real time as either of you logs a deposit.',
      },
      {
        id: 'pct-color',
        title: 'Color-coded milestones',
        body: 'The percentage shifts color as you get closer — neutral when starting, brand orange in progress, gold near the finish, green when the goal is reached.',
      },
    ],
  };
}
