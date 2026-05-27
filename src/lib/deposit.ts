export function sanitizeDepositAmount(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export function resolveDepositAmount(amountValue: string, quickAmount: number | null): number {
  const customAmount = Number(amountValue);
  return amountValue.trim() !== '' && customAmount > 0 ? customAmount : quickAmount ?? 0;
}

export function cleanQuickAmounts(amounts: number[]): number[] {
  return Array.from(new Set(amounts.map(Number)))
    .filter(amount => Number.isInteger(amount) && amount > 0)
    .slice(0, 6);
}

export function depositSlipMarker(file: File | null): string | null {
  return file ? `attached:${file.name}` : null;
}
