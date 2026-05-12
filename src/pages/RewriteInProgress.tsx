import { useAuth } from '../hooks/useAuth';

/**
 * Temporary placeholder route mounted at `/` while the new UI is being
 * rebuilt. Steps 5–7 of the rewrite will replace this with the real
 * Dashboard / Deposit / Profile pages.
 */
export function RewriteInProgress() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      <div className="surface-raised w-full max-w-sm rounded-2xl p-7 flex flex-col items-center gap-4 animate-fade-in-up">
        <span className="font-mono text-brand-800 text-sm tracking-widest uppercase">
          GO-OUT
        </span>
        <h1 className="text-2xl text-center">Rewrite in progress</h1>
        <p className="text-sm text-ink-muted text-center">
          The new warm-tone UI is being built component-by-component. The data layer is wired,
          but the dashboard, deposit, and profile flows ship in the next PRs.
        </p>
        {profile && (
          <p className="text-xs text-ink-dim text-center">
            Signed in as {profile.display_name}
          </p>
        )}
        <button
          onClick={signOut}
          className="text-xs text-ink-muted underline-offset-2 hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
