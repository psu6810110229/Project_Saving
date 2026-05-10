import { formatCurrency } from '../../lib/format';

interface Props {
  leaderName: string | null;
  gapAmount: number;
}

export function GapBadge({ leaderName, gapAmount }: Props) {
  if (gapAmount === 0) {
    return (
      <p className="text-xs text-ink-muted text-center py-1">
        Tied — keep going!
      </p>
    );
  }

  return (
    <p className="text-xs text-terracotta font-medium text-center py-1">
      {leaderName} leads by {formatCurrency(gapAmount)}
    </p>
  );
}
