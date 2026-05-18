import { type ReactNode, useRef } from 'react';
import { BottomTabItem } from '../BottomTabItem/BottomTabItem';
import { IconGrid, IconPlus, IconUser } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';

export type BottomNavTab = 'dashboard' | 'add' | 'profile';

interface BottomNavProps {
  activeTab: BottomNavTab;
  onChange: (tab: BottomNavTab) => void;
}

const TAB_ICONS: { id: BottomNavTab; icon: ReactNode }[] = [
  { id: 'dashboard', icon: <IconGrid size={20} /> },
  { id: 'add', icon: <IconPlus size={20} /> },
  { id: 'profile', icon: <IconUser size={20} /> },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const { copy } = useI18n();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  return (
    <nav
      ref={navRef}
      className="shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-0 bg-transparent"
    >
      <div
        ref={pillRef}
        className="relative mx-auto max-w-md rounded-full px-2 py-1.5 flex items-center bg-white/30 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/40 shadow-[0_4px_24px_-6px_rgba(60,40,20,0.12)]"
      >
        {/* Tabs */}
        <div className="relative z-10 flex items-center w-full">
          {TAB_ICONS.map(tab => (
            <BottomTabItem
              key={tab.id}
              label={copy.nav[tab.id]}
              icon={tab.icon}
              active={activeTab === tab.id}
              onClick={() => onChange(tab.id)}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
