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
      className="flex flex-col items-center gap-1 flex-1 py-1 outline-none"
      aria-current={active ? 'page' : undefined}
    >
      <span className="relative inline-flex items-center justify-center w-9 h-7">
        {active && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 rounded-md bg-brand-50 ring-1 ring-brand-100"
          />
        )}
        <motion.span
          animate={{
            color: active ? '#8E3F0D' : '#7A6A5E',
          }}
          transition={{ duration: 0.12 }}
          className="relative z-10"
        >
          {icon}
        </motion.span>
      </span>
      <motion.span
        animate={{
          color: active ? '#8E3F0D' : '#7A6A5E',
          opacity: active ? 1 : 0.78,
        }}
        transition={{ duration: 0.12 }}
        className="text-[10px] tracking-wider font-mono font-bold uppercase"
      >
        {label}
      </motion.span>
    </motion.button>
  );
}
