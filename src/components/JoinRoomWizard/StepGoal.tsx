import { Button } from '../Button/Button';
import { useI18n } from '../../i18n/useI18n';
import { formatCurrency } from '../../lib/format';

interface StepGoalProps {
  personalGoal: number;
  roomGoalTarget: number | null;
  onGoalChange: (goal: number) => void;
  onNext: () => void;
}

export function StepGoal({ personalGoal, roomGoalTarget, onGoalChange, onNext }: StepGoalProps) {
  const { copy } = useI18n();
  const c = copy.joinRoomWizard;

  const isValid = personalGoal > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-mono text-2xl font-bold text-ink">{c.stepGoalTitle}</h2>
        <p className="mt-1 font-mono text-sm text-ink-muted">{c.stepGoalSubtitle}</p>
      </div>

      <div className="rounded-xl bg-surface p-5 shadow-soft">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-xs font-bold text-ink-muted">{c.personalGoalLabel}</span>
          <input
            type="number"
            min={0}
            step={100}
            inputMode="decimal"
            placeholder={c.personalGoalPlaceholder}
            value={personalGoal > 0 ? String(personalGoal) : ''}
            onChange={e => onGoalChange(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
            className="rounded-lg bg-well px-3 py-2.5 font-mono text-sm text-ink shadow-neuPressed outline-none focus:ring-2 focus:ring-brand-500"
            autoFocus
          />
        </label>
        {roomGoalTarget !== null && roomGoalTarget > 0 && (
          <p className="mt-2 font-mono text-xs text-brand-700">
            {c.roomGoalHint(formatCurrency(roomGoalTarget))}
          </p>
        )}
      </div>

      <Button variant="action" fullWidth disabled={!isValid} onClick={onNext}>
        {copy.createRoomWizard.nextButton}
      </Button>
    </div>
  );
}
