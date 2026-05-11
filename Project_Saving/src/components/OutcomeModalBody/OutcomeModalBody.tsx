import type { ReactNode } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';

/**
 * Body of the Success / Fail / Expired modals (and Profile Update Success
 * / Error toasts). Big icon at top, headline, body copy, then action
 * buttons rendered by the parent as `children`.
 *
 * The outer Modal shell (overlay + dismiss) is an organism in Step 7 —
 * this molecule is just the body content so it can be reused in toasts,
 * full-screen modals, and inline error banners.
 */

type Outcome = 'success' | 'fail' | 'expired';

interface OutcomeModalBodyProps {
  outcome: Outcome;
  icon: ReactNode;
  title: string;
  body?: string;
  children?: ReactNode;
}

const TONE: Record<Outcome, 'solid' | 'peach' | 'muted'> = {
  success: 'solid',
  fail:    'peach',
  expired: 'muted',
};

const TITLE_TONE: Record<Outcome, string> = {
  success: 'text-ink',
  fail:    'text-danger',
  expired: 'text-ink',
};

export function OutcomeModalBody({ outcome, icon, title, body, children }: OutcomeModalBodyProps) {
  return (
    <div className="flex flex-col items-center text-center gap-3 p-6">
      <IconBubble tone={TONE[outcome]} size="xl">{icon}</IconBubble>
      <h3 className={`font-mono text-xl font-bold ${TITLE_TONE[outcome]}`}>{title}</h3>
      {body && <p className="font-mono text-sm text-ink-muted">{body}</p>}
      {children && <div className="mt-2 w-full flex flex-col gap-2">{children}</div>}
    </div>
  );
}
