import type { ReactNode } from 'react';
import { OutcomeModalBody } from '../OutcomeModalBody/OutcomeModalBody';

type Outcome = 'success' | 'fail' | 'expired';

interface OutcomeModalProps {
  open: boolean;
  outcome: Outcome;
  icon: ReactNode;
  title: string;
  body?: string;
  children?: ReactNode;
}

export function OutcomeModal({
  open,
  outcome,
  icon,
  title,
  body,
  children,
}: OutcomeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 min-h-[100dvh] bg-bg px-4 py-8 flex items-center justify-center">
      <section className="w-full max-w-sm rounded-3xl bg-surface shadow-soft">
        <OutcomeModalBody outcome={outcome} icon={icon} title={title} body={body}>
          {children}
        </OutcomeModalBody>
      </section>
    </div>
  );
}
