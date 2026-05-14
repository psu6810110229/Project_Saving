import { palette } from './theme';

export const chartIdentityColors = {
  you: palette.brand500,
  partner: palette.accentTeal,
} as const;

export function chartLegendLabel(role: 'You' | 'Partner', displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed && trimmed.toLowerCase() !== role.toLowerCase()
    ? `${role} · ${trimmed}`
    : role;
}
