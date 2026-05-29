import { useI18n } from '../i18n/useI18n';

/**
 * Team — group/social hub. Holds the leaderboard, momentum chart, room
 * activity feed, and nudge actions. This is the shell; group surfaces move
 * here from the Dashboard in a follow-up slice.
 */
export function Team() {
  const { copy } = useI18n();
  const t = copy.team;

  return (
    <div className="flex flex-col gap-6 pt-8 pb-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-mono text-2xl font-bold leading-tight text-ink">
          {t.pageTitle}
        </h1>
        <p className="font-mono text-sm text-ink-muted">{t.pageSubtitle}</p>
      </header>

      <div className="rounded-xl bg-surface p-6 text-center shadow-soft">
        <p className="font-mono text-sm text-ink-muted">{t.placeholder}</p>
      </div>
    </div>
  );
}
