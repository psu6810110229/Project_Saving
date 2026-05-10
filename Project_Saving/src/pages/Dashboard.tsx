import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useGoal } from '../hooks/useGoal';
import { useSavingsTotal } from '../hooks/useSavingsTotal';
import { CountdownCard } from '../components/CountdownCard/CountdownCard';
import { ForecastCard } from '../components/ForecastCard/ForecastCard';

export function Dashboard() {
  const { profile, signOut } = useAuth();
  const { goal, loading: goalLoading } = useGoal();
  const { total } = useSavingsTotal(profile?.id);

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-sm mx-auto flex flex-col gap-5">

        <div className="flex items-center justify-between">
          <h1 className="text-xl text-ink font-semibold">
            Hey, {profile?.display_name ?? '…'} 👋
          </h1>
          <div className="flex items-center gap-3">
            <Link to="/settings" className="text-ink-muted text-sm">Settings</Link>
            <button onClick={signOut} className="text-ink-muted text-sm">Sign out</button>
          </div>
        </div>

        <CountdownCard />

        {goalLoading ? (
          <div className="bg-surface border border-border rounded-xl p-5 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
          </div>
        ) : (
          <ForecastCard goal={goal} savedSoFar={total} />
        )}

      </div>
    </div>
  );
}
