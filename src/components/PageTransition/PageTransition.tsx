import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

const SPRING = { type: 'spring', damping: 24, stiffness: 200 } as const;

interface PageTransitionProps {
  transitionKey: string;
  children: ReactNode;
}

export function PageTransition({ transitionKey, children }: PageTransitionProps) {
  return (
    <motion.div
      key={transitionKey}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
    >
      {children}
    </motion.div>
  );
}
