import type { ReactNode } from 'react';

interface PageTransitionProps {
  transitionKey: string;
  children: ReactNode;
}

export function PageTransition({ transitionKey, children }: PageTransitionProps) {
  return (
    <div key={transitionKey} className="animate-fade-in-up">
      {children}
    </div>
  );
}
