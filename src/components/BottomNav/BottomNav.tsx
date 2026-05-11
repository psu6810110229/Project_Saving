import type { ReactNode } from 'react';
import { BottomTabItem } from '../BottomTabItem/BottomTabItem';
import { IconGrid, IconPlus, IconUser } from '../Icon/Icon';

export type BottomNavTab = 'dashboard' | 'add' | 'profile';

interface BottomNavProps {
  activeTab: BottomNavTab;
  onChange: (tab: BottomNavTab) => void;
}

const TABS: { id: BottomNavTab; label: string; icon: ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <IconGrid size={22} /> },
  { id: 'add', label: 'Add', icon: <IconPlus size={24} /> },
  { id: 'profile', label: 'Profile', icon: <IconUser size={22} /> },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-bg/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur">
      <div className="mx-auto max-w-md rounded-3xl bg-surface shadow-soft px-2 py-2 flex items-center">
        {TABS.map(tab => (
          <BottomTabItem
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
          />
        ))}
      </div>
    </nav>
  );
}
