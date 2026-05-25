import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SPRING } from '../../lib/motion';

interface BottomTabItemProps {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function BottomTabItem({ label, icon, active = false, onClick }: BottomTabItemProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.86 }}
      transition={SPRING.press}
      className="flex flex-1 flex-col items-center py-0.5 outline-none"
      aria-current={active ? 'page' : undefined}
    >
      <span className="relative inline-flex h-7 w-14 items-center justify-center">
        <motion.span
          animate={{
            color: active ? '#8E3F0D' : '#7A6A5E',
            scale: active ? 1.08 : 1,
          }}
          transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
          className={
            'relative z-10 drop-shadow-[0_1px_0_rgba(255,255,255,0.5)] ' +
            (active ? 'filter drop-shadow-[0_6px_10px_rgba(142,63,13,0.22)]' : '')
          }
        >
          {icon}
        </motion.span>
      </span>
      <motion.span
        animate={{
          color: active ? '#8E3F0D' : '#7A6A5E',
          opacity: active ? 1 : 0.72,
          y: active ? -1 : 0,
        }}
        transition={{ duration: 0.16 }}
        className="font-mono text-[11px] font-bold leading-tight"
      >
        {label}
      </motion.span>
    </motion.button>
  );
}
