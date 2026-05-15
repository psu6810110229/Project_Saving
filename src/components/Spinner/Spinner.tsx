import { useI18n } from '../../i18n/useI18n';

interface SpinnerProps {
  size?: 'sm' | 'md';
  label?: string;
}

const SIZES = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
};

export function Spinner({ size = 'md', label }: SpinnerProps) {
  const { copy } = useI18n();
  const resolvedLabel = label ?? copy.common.loading;
  return (
    <div
      aria-label={resolvedLabel}
      role="status"
      className={`${SIZES[size]} rounded-full border-brand-500 border-t-transparent animate-spin`}
    />
  );
}
