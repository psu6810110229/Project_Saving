import { formatCurrency } from '../../lib/format';

interface Props {
  leaderName: string | null;
  gapAmount: number;
}

export function GapBadge({ leaderName, gapAmount }: Props) {
  if (gapAmount === 0) {
    return (
      <div className="flex justify-center py-1">
        <span className="bg-surface border border-border text-ink-muted text-xs font-medium px-4 py-1.5 rounded-full">
          Dead heat — keep going!
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-1">
      <span className="bg-terracotta text-white text-xs font-semibold px-4 py-1.5 rounded-full">
        {leaderName} leads by {formatCurrency(gapAmount)}
      </span>
    </div>
  );
}
