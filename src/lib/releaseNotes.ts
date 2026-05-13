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
    heading: 'App Updated',
    intro: 'This release includes the latest alpha follow-up updates through bucket editing and safer bucket deletion.',
    notes: [
      {
        id: 'release-popup',
        title: 'Feature update popup',
        body: 'New app updates now have a dedicated popup with a temporary close action and a persistent Understand button.',
      },
      {
        id: 'version-surface',
        title: 'Version visibility',
        body: 'The visible app version is ready to help alpha testers confirm which build they are using.',
      },
      {
        id: 'pwa-freshness',
        title: 'Installed app freshness',
        body: 'The installed app now checks for fresh service worker assets and reloads after an update activates.',
      },
      {
        id: 'shared-room-goal',
        title: 'Shared project goal sync',
        body: 'Project target and end date changes now update every room member so both dashboards stay aligned.',
      },
      {
        id: 'manage-project-consolidation',
        title: 'Project settings consolidation',
        body: 'Quick amounts and bucket setup now live in Manage Project so Profile stays focused on account settings.',
      },
      {
        id: 'bucket-edit-delete',
        title: 'Bucket rename, target edit, and delete confirmation',
        body: 'Buckets can now be renamed, retargeted, and deleted from Manage Project, with confirmation and history-aware delete blocking.',
      },
    ],
  };
}
