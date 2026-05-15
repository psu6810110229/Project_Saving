import type { Messages } from '../i18n/messages';
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
  notes: readonly ReleaseNote[];
}

export function currentReleaseNotes(copy: Messages['release']): ReleaseNotes {
  return {
    version: appVersion(),
    heading: copy.heading,
    intro: copy.intro,
    notes: copy.notes,
  };
}
