import { useMemo, useState } from 'react';
import { Button } from '../Button/Button';
import { IconBell, IconCheck } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { currentReleaseNotes } from '../../lib/releaseNotes';

const UNDERSTOOD_KEY = 'releaseUnderstoodVersion';
const SESSION_DISMISSED_KEY = 'releaseDismissedSessionVersion';

export function ReleaseUpdateModal() {
  const release = useMemo(() => currentReleaseNotes(), []);
  const [open, setOpen] = useState(() => shouldOpenRelease(release.version));

  function handleClose() {
    window.sessionStorage.setItem(SESSION_DISMISSED_KEY, release.version);
    setOpen(false);
  }

  function handleUnderstand() {
    window.localStorage.setItem(UNDERSTOOD_KEY, release.version);
    window.sessionStorage.removeItem(SESSION_DISMISSED_KEY);
    setOpen(false);
  }

  return (
    <Modal open={open} title={release.heading} onClose={handleClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-brand-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-brand-800 shadow-soft">
              <IconBell size={20} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-800">
                Version {release.version}
              </p>
              <p className="mt-1 font-mono text-xs text-ink-muted">{release.intro}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {release.notes.map(note => (
            <article key={note.id} className="rounded-2xl bg-surface px-4 py-3 shadow-soft">
              <div className="flex gap-3">
                <span className="mt-0.5 text-brand-700">
                  <IconCheck size={16} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-mono text-sm font-bold text-ink">{note.title}</h3>
                  <p className="mt-1 font-mono text-xs leading-5 text-ink-muted">{note.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <Button variant="action" fullWidth onClick={handleUnderstand}>
          Understand
        </Button>
      </div>
    </Modal>
  );
}

function shouldOpenRelease(version: string): boolean {
  if (typeof window === 'undefined') return false;
  const understood = window.localStorage.getItem(UNDERSTOOD_KEY);
  const dismissed = window.sessionStorage.getItem(SESSION_DISMISSED_KEY);
  return understood !== version && dismissed !== version;
}
