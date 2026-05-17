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
      whileTap={{ scale: 0.88 }}
      transition={SPRING.press}
      className="flex flex-col items-center gap-1 flex-1 py-1 outline-none"
      aria-current={active ? 'page' : undefined}
    >
      <span className="relative inline-flex items-center justify-center w-11 h-11">
        {active && (
          <motion.span
            layoutId="bottom-tab-indicator"
            className="absolute inset-0 rounded-full bg-brand-800 shadow-[0_4px_12px_-2px_rgba(142,63,13,0.45),inset_0_1px_0_0_rgba(255,255,255,0.25)]"
            transition={SPRING.tab}
          />
        )}
        <motion.span
          animate={{
            scale: active ? 1.08 : 1,
            color: active ? '#FFF8F0' : '#7A6A5E',
          }}
          transition={SPRING.tab}
          className="relative z-10"
        >
          {icon}
        </motion.span>
      </span>
      <motion.span
        animate={{
          color: active ? '#8E3F0D' : '#7A6A5E',
          opacity: active ? 1 : 0.78,
          y: active ? 0 : 1,
        }}
        transition={SPRING.tab}
        className="text-[11px] tracking-wider font-mono font-semibold uppercase"
      >
        {label}
      </motion.span>
    </motion.button>
  );
}
