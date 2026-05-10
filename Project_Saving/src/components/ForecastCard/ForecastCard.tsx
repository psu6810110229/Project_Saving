import { Link } from 'react-router-dom';
import type { Goal } from '../../types';
import { dailyRequired, predictedCompletion, daysBetween } from '../../lib/forecast';

interface Props {
  goal: Goal | null;
  savedSoFar: number;
}

function formatCurrency(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ForecastCard({ goal, savedSoFar }: Props) {
  if (!goal) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-2">
        <span className="text-xs text-ink-muted uppercase tracking-widest">Forecast</span>
        <p className="text-sm text-ink-muted">No goal set yet.</p>
        <Link to="/settings" className="text-terracotta text-sm font-medium">Set your goal →</Link>
      </div>
    );
  }

  const today = new Date();
  const start = new Date(goal.start_date + 'T00:00:00');
  const daysElapsed = Math.max(0, daysBetween(start, today));
  const required = dailyRequired(goal, savedSoFar, today);
  const completion = predictedCompletion(goal, savedSoFar, daysElapsed);
  const percent = Math.min(100, Math.round((savedSoFar / goal.target_amount) * 100));
  const endPassed = new Date(goal.end_date + 'T00:00:00') < today;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
      <span className="text-xs text-ink-muted uppercase tracking-widest">Progress</span>

      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-ink">{formatCurrency(savedSoFar)}</span>
        <span className="text-sm text-ink-muted">of {formatCurrency(goal.target_amount)}</span>
      </div>

      <div className="w-full bg-border rounded-full h-2">
        <div
          className="bg-terracotta h-2 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-ink-muted">
        <span>{percent}% saved</span>
        <span>{formatCurrency(goal.target_amount - savedSoFar)} remaining</span>
      </div>

      <div className="border-t border-border pt-3 flex flex-col gap-1">
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">Daily required</span>
          <span className="text-ink font-medium">{formatCurrency(required)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">On track to finish</span>
          <span className="text-ink font-medium">{completion ? formatDate(completion) : '—'}</span>
        </div>
      </div>

      {endPassed && (
        <p className="text-xs text-terracotta">Goal date passed — extend it in Settings.</p>
      )}
    </div>
  );
}
