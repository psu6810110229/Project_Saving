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
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 flex-1 py-1 transition-transform duration-100 ease-out active:scale-[0.96]"
      aria-current={active ? 'page' : undefined}
    >
      <span className="relative inline-flex items-center justify-center w-11 h-11">
        {active && (
          <motion.span
            layoutId="bottom-tab-indicator"
            className="absolute inset-0 rounded-full bg-brand-800"
            transition={SPRING.tab}
          />
        )}
        <span className={`relative z-10 transition-colors duration-150 ${active ? 'text-ink-inverse' : 'text-ink-muted'}`}>
          {icon}
        </span>
      </span>
      {/* Stable font-semibold in both states to prevent text-width jumps.
          Only color changes — animate via framer-motion spring. */}
      <motion.span
        animate={{ color: active ? '#8E3F0D' : '#7A6A5E' }}
        transition={SPRING.tab}
        className="text-[11px] tracking-wider font-mono font-semibold uppercase"
      >
        {label}
      </motion.span>
    </button>
  );
}
