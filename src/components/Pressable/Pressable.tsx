import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { SPRING } from '../../lib/motion';

interface PressableProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export default function Pressable({
  children,
  onClick,
  className = '',
  disabled = false,
  ariaLabel,
}: PressableProps) {
  const reduceMotion = useReducedMotion();

  const motionProps = disabled
    ? {}
    : reduceMotion
      ? {
          whileTap: { opacity: 0.85 },
          transition: SPRING.press,
        }
      : {
          whileTap: { scale: 0.97, y: 2 },
          whileHover: { scale: 1.01, y: -1 },
          transition: SPRING.press,
        };

  return (
    <motion.div
      className={className}
      onClick={disabled ? undefined : onClick}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      role={onClick ? 'button' : undefined}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
