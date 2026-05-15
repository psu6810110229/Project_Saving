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
    heading: 'GO-OUT v0.9.5',
    intro: 'Notifications cover more of the project, more quietly.',
    notes: [
      {
        id: 'saving-reminders',
        title: 'Saving reminders for active plans',
        body: 'If you have an active Saving Plan and have not recorded for the current day, week, or month, a calm reminder appears after 18:00 Bangkok time.',
      },
      {
        id: 'partner-activity',
        title: 'Partner activity in Notifications',
        body: 'Deposits, balance checks, plan and goal changes, new buckets, and partner joining or leaving the project now show up in the in-app Notification Center.',
      },
      {
        id: 'milestone-moments',
        title: 'Milestone moments',
        body: 'Reaching a bucket target, the shared project goal, a saving-day streak, or moving ahead of your partner now creates a quiet, positive notification.',
      },
      {
        id: 'settings-honor-toggles',
        title: 'Settings respect your toggles',
        body: 'Turning Notifications or Partner activity off mutes future deliveries while keeping your past history visible. Reminders and nudges still follow their own toggles.',
      },
    ],
  };
}
