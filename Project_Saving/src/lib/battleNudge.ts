import { formatCurrency } from './format';

interface NudgeInput {
  myTotal: number;
  partnerTotal: number;
  partnerName: string;
  pendingAmount: number;
}

export function computeNudge({ myTotal, partnerTotal, partnerName, pendingAmount }: NudgeInput): string {
  const amount = Math.max(0, isNaN(pendingAmount) ? 0 : pendingAmount);
  const projected = myTotal + amount;
  const gap = projected - partnerTotal;

  if (amount === 0) {
    const restingGap = myTotal - partnerTotal;
    if (restingGap > 0) return `You lead ${partnerName} by ${formatCurrency(restingGap)} — keep the heat 🔥`;
    if (restingGap < 0) return `Save ${formatCurrency(Math.abs(restingGap))} to overtake ${partnerName}`;
    return `Dead heat — any save puts you in the lead`;
  }

  if (gap > 0) return `${formatCurrency(amount)} puts you ${formatCurrency(gap)} ahead of ${partnerName} 🔥`;
  if (gap < 0) return `${formatCurrency(amount)} closes the gap — ${formatCurrency(Math.abs(gap))} more to overtake`;
  return `${formatCurrency(amount)} ties the score — one more pushes you ahead`;
}
