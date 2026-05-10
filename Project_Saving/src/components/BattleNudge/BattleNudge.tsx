import { computeNudge } from '../../lib/battleNudge';

interface Props {
  myTotal: number;
  partnerTotal: number;
  partnerName: string;
  pendingAmount: number;
}

export function BattleNudge({ myTotal, partnerTotal, partnerName, pendingAmount }: Props) {
  const text = computeNudge({ myTotal, partnerTotal, partnerName, pendingAmount });
  const projected = myTotal + Math.max(0, pendingAmount);
  const isAhead = projected > partnerTotal;

  return (
    <p className={`text-sm transition-all duration-200 ${isAhead ? 'text-terracotta font-medium' : 'text-ink-muted'}`}>
      {text}
    </p>
  );
}
