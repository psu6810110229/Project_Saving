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
      className="shrink-0 border-t border-ink/10 bg-surface/90 px-[max(env(safe-area-inset-left),env(safe-area-inset-right),0px)] pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-1 backdrop-blur-xl"
    >
      <div
        ref={pillRef}
        className="relative mx-auto max-w-xs px-2 flex items-center"
      >
        {/* Tabs */}
        <div className="relative flex items-center w-full">
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
