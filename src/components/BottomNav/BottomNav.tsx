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
  { id: 'dashboard', icon: <IconGrid size={22} /> },
  { id: 'add', icon: <IconPlus size={22} /> },
  { id: 'profile', icon: <IconUser size={22} /> },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const { copy } = useI18n();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  return (
    <nav
      ref={navRef}
      className="shrink-0 bg-bg/97 px-[max(env(safe-area-inset-left),env(safe-area-inset-right),0px)] pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1 shadow-[0_-3px_10px_rgba(42,26,14,0.055)]"
    >
      <div
        ref={pillRef}
        className="relative mx-auto flex w-full max-w-md items-center px-3"
      >
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
