import { useAuth } from '../hooks/useAuth';

export function Dashboard() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-sm mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl text-ink font-semibold">
            Hey, {profile?.display_name ?? '…'} 👋
          </h1>
          <button
            onClick={signOut}
            className="text-ink-muted text-sm hover:text-ink"
          >
            Sign out
          </button>
        </div>
        <p className="text-ink-muted text-sm">Dashboard coming in Task 5.</p>
      </div>
    </div>
  );
}
