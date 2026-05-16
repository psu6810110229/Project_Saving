import { Spinner } from '../Spinner/Spinner';

interface LoadingStateProps {
  label?: string;
  title?: string;
  body?: string;
  variant?: 'fullscreen' | 'card' | 'inline';
}

const VARIANT_CLASS = {
  fullscreen: 'min-h-[100dvh] px-6',
  card: '',
  inline: 'py-6',
};

export function LoadingState({
  label,
  title = 'GO-OUT',
  body,
  variant = 'inline',
}: LoadingStateProps) {
  const resolvedBody = body ?? label;
  const content = (
    <section
      aria-busy="true"
      aria-live="polite"
      className="w-full max-w-sm rounded-xl border border-white/70 bg-surface/85 p-5 text-center shadow-soft backdrop-blur-xl"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 shadow-neuPressed">
        <Spinner size="sm" tone="brand" label={label} />
      </div>
      <p className="mt-4 font-mono text-xs font-bold uppercase tracking-wide text-brand-800">{title}</p>
      {resolvedBody && (
        <p className="mt-2 font-mono text-xs leading-5 text-ink-muted">{resolvedBody}</p>
      )}
    </section>
  );

  if (variant === 'card') return content;

  return (
    <div className={`${VARIANT_CLASS[variant]} flex items-center justify-center`}>
      {content}
    </div>
  );
}
