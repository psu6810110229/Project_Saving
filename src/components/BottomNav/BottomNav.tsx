import type { ReactNode } from 'react';
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
  { id: 'add', icon: <IconPlus size={24} /> },
  { id: 'profile', icon: <IconUser size={22} /> },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const { copy } = useI18n();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-bg/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
      <div className="mx-auto max-w-md rounded-xl bg-surface shadow-soft px-2 py-2 flex items-center">
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
    </nav>
  );
}
