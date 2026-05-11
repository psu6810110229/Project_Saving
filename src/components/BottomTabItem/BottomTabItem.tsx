import type { ReactNode } from 'react';

/**
 * Single tab in the floating bottom tab bar. Inactive = stacked icon + label
 * in ink-muted. Active = brand-800 filled circle around the icon, with the
 * label sitting underneath (Dashboard / Vault / Profile in the mockups).
 */

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
      className="flex flex-col items-center gap-1.5 flex-1 py-1"
      aria-current={active ? 'page' : undefined}
    >
      <span
        className={
          'inline-flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 ' +
          (active ? 'bg-brand-800 text-ink-inverse' : 'text-ink-muted')
        }
      >
        {icon}
      </span>
      <span
        className={`text-[11px] tracking-wider font-mono uppercase ${active ? 'text-brand-800 font-bold' : 'text-ink-muted'}`}
      >
        {label}
      </span>
    </button>
  );
}
