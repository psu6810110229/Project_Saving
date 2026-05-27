import { useMemo, useState } from 'react';
import { Button } from '../Button/Button';
import { IconBell, IconCheck } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { useI18n } from '../../i18n/useI18n';
import { currentReleaseNotes } from '../../lib/releaseNotes';

const UNDERSTOOD_KEY = 'releaseUnderstoodVersion';
const SESSION_DISMISSED_KEY = 'releaseDismissedSessionVersion';

export function ReleaseUpdateModal() {
  const { copy } = useI18n();
  const release = useMemo(() => currentReleaseNotes(copy.release), [copy.release]);
  const [open, setOpen] = useState(() => shouldOpenRelease(release.version));
  const [showAll, setShowAll] = useState(false);
  const visibleNotes = showAll ? release.notes : release.notes.slice(0, 4);
  const hiddenCount = release.notes.length - visibleNotes.length;

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
      <div className="flex h-[calc(88dvh-5.5rem)] min-h-0 flex-col">
        <div className="shrink-0 rounded-lg bg-brand-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-brand-800 shadow-soft">
              <IconBell size={20} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-800">
                {copy.release.versionLabel(release.version)}
              </p>
              <p className="mt-1 font-mono text-xs text-ink-muted">{release.intro}</p>
            </div>
          </div>
        </div>

        <div className="relative mt-4 min-h-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-3 bg-gradient-to-b from-bg to-transparent" />
          <div className="h-full touch-pan-y overflow-y-auto overscroll-contain pr-1 pt-1 pb-3 [WebkitOverflowScrolling:touch]">
            <div className="flex flex-col gap-2">
              {visibleNotes.map(note => (
                <article key={note.id} className="rounded-lg bg-surface px-4 py-3 shadow-soft">
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
              {hiddenCount > 0 && (
                <Button variant="ghost" size="md" fullWidth onClick={() => setShowAll(true)}>
                  {copy.release.viewAllChanges(hiddenCount)}
                </Button>
              )}
              {showAll && release.notes.length > 4 && (
                <Button variant="ghost" size="md" fullWidth onClick={() => setShowAll(false)}>
                  {copy.release.showLess}
                </Button>
              )}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-bg to-transparent" />
        </div>

        <div className="shrink-0 border-t border-brand-100 bg-bg pt-3">
          <Button variant="action" fullWidth onClick={handleUnderstand}>
            {copy.common.done}
          </Button>
        </div>
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
