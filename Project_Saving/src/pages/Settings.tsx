import { Link } from 'react-router-dom';
import { GoalForm } from '../components/GoalForm/GoalForm';
import { useGoal } from '../hooks/useGoal';

export function Settings() {
  const { goal, loading, save } = useGoal();

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-sm mx-auto flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-ink-muted text-sm">← Back</Link>
          <h1 className="text-xl text-ink font-semibold">Savings Goal</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
          </div>
        ) : (
          <GoalForm initial={goal} onSave={save} />
        )}
      </div>
    </div>
  );
}
