import { appVersion } from '../../lib/version';

/**
 * Tiny monospace chip pinned to the top-right of AppShell. Always
 * visible across Dashboard / Add / Profile so the user can read the
 * current build at a glance.
 */

interface VersionChipProps {
  className?: string;
}

export function VersionChip({ className = '' }: VersionChipProps) {
  return (
    <span
      aria-label="App version"
      className={
        'pointer-events-none select-none rounded-pill bg-surface px-2 py-0.5 ' +
        'font-mono text-[10px] font-medium text-ink-muted shadow-soft ' +
        className
      }
    >
      v{appVersion()}
    </span>
  );
}
