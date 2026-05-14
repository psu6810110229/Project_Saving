import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OutcomeModalBody } from '../OutcomeModalBody/OutcomeModalBody';

const SPRING = { type: 'spring', damping: 26, stiffness: 280 } as const;

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
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="outcome-modal"
          className="fixed inset-0 z-50 min-h-[100dvh] bg-bg/90 backdrop-blur-sm px-4 py-8 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.section
            className="w-full max-w-sm rounded-xl bg-surface shadow-neuRaised"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={SPRING}
          >
            <OutcomeModalBody outcome={outcome} icon={icon} title={title} body={body}>
              {children}
            </OutcomeModalBody>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
