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
    heading: 'GO-OUT v0.9.4',
    intro: 'Notifications now have a safer nudge flow.',
    notes: [
      {
        id: 'nudge-notification',
        title: 'Nudges now land in Notifications',
        body: 'A partner nudge creates an in-app notification, so the check-in is visible even when push delivery is skipped.',
      },
      {
        id: 'nudge-routing',
        title: 'Push taps open the right place',
        body: 'Nudge push notifications now use safe dashboard routing when the app is opened or focused from a notification.',
      },
      {
        id: 'nudge-cooldown',
        title: 'Clear cooldown feedback',
        body: 'If you already nudged recently, the button now explains the short wait instead of showing a generic error.',
      },
    ],
  };
}
