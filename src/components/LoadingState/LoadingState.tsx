import { useEffect, useState } from 'react';
import { Spinner } from '../Spinner/Spinner';

interface LoadingStateProps {
  label?: string;
  title?: string;
  body?: string;
  variant?: 'fullscreen' | 'card' | 'inline';
  messages?: readonly string[];
  slow?: boolean;
  slowMessage?: string;
  messageRotateMs?: number;
}

const VARIANT_CLASS = {
  fullscreen: 'min-h-[100dvh] px-6',
  card: '',
  inline: 'py-6',
};

const DEFAULT_ROTATE_MS = 1000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function LoadingState({
  label,
  title = 'GO-OUT',
  body,
  variant = 'inline',
  messages,
  slow = false,
  slowMessage,
  messageRotateMs = DEFAULT_ROTATE_MS,
}: LoadingStateProps) {
  const hasMessages = !!messages && messages.length > 0;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!hasMessages || !messages) return;
    const id = window.setTimeout(() => {
      setIndex(Math.floor(Math.random() * messages.length));
    }, 0);
    return () => window.clearTimeout(id);
  }, [hasMessages, messages]);

  useEffect(() => {
    if (!hasMessages || !messages || slow) return;
    if (prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, messageRotateMs);
    return () => window.clearInterval(id);
  }, [hasMessages, messages, slow, messageRotateMs]);

  let rotatingBody: string | undefined;
  if (hasMessages && messages) {
    if (slow && slowMessage) rotatingBody = slowMessage;
    else rotatingBody = messages[index % messages.length];
  }

  const resolvedBody = rotatingBody ?? body ?? label;

  const content = (
    <section
      aria-busy="true"
      aria-live="polite"
      className="w-full max-w-sm rounded-xl border border-white/70 bg-surface p-5 text-center shadow-soft"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 shadow-neuPressed">
        <Spinner size="sm" tone="brand" label={label} />
      </div>
      <p className="mt-4 font-mono text-xs font-bold uppercase tracking-wide text-brand-800">{title}</p>
      {resolvedBody && (
        <p
          className="mt-2 font-mono text-xs leading-5 text-ink-muted"
          aria-hidden={hasMessages ? true : undefined}
        >
          {resolvedBody}
        </p>
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
