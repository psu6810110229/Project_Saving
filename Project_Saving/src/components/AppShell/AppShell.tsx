import type { ReactNode } from 'react';
import { BottomNav, type BottomNavTab } from '../BottomNav/BottomNav';

interface AppShellProps {
  activeTab: BottomNavTab;
  onTabChange: (tab: BottomNavTab) => void;
  children: ReactNode;
}

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
  return (
    <div className="min-h-[100dvh] bg-bg text-ink">
      <main className="mx-auto max-w-md px-4 pt-6 pb-32">
        {children}
      </main>
      <BottomNav activeTab={activeTab} onChange={onTabChange} />
    </div>
  );
}
