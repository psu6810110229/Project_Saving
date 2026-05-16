import { useI18n } from '../../i18n/useI18n';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  tone?: 'brand' | 'neutral' | 'inverse';
}

const SIZES = {
  sm: 'h-4 w-4 border-[1.5px]',
  md: 'h-7 w-7 border-2',
  lg: 'h-10 w-10 border-2',
};

const TONES = {
  brand: 'text-brand-500',
  neutral: 'text-ink-muted',
  inverse: 'text-ink-inverse',
};

export function Spinner({ size = 'md', label, tone = 'brand' }: SpinnerProps) {
  const { copy } = useI18n();
  const resolvedLabel = label ?? copy.common.loading;
  return (
    <div
      aria-label={resolvedLabel}
      role="status"
      className={`${SIZES[size]} ${TONES[tone]} rounded-full border-current border-t-transparent opacity-90 animate-spin motion-reduce:animate-none`}
    />
  );
}
