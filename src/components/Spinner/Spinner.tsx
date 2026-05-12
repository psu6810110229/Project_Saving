interface SpinnerProps {
  size?: 'sm' | 'md';
  label?: string;
}

const SIZES = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
};

export function Spinner({ size = 'md', label = 'Loading' }: SpinnerProps) {
  return (
    <div
      aria-label={label}
      role="status"
      className={`${SIZES[size]} rounded-full border-brand-500 border-t-transparent animate-spin`}
    />
  );
}
