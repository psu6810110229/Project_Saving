import type { ReactNode } from 'react';
import { AppUpdateAvailableModal } from '../AppUpdateAvailableModal/AppUpdateAvailableModal';
import { BottomNav, type BottomNavTab } from '../BottomNav/BottomNav';
import { ReleaseUpdateModal } from '../ReleaseUpdateModal/ReleaseUpdateModal';

interface AppShellProps {
  activeTab: BottomNavTab;
  onTabChange: (tab: BottomNavTab) => void;
  children: ReactNode;
}

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
  return (
    <div className="flex h-[100dvh] flex-col text-ink">
      <div
        aria-hidden
        className="app-shell-status-seam pointer-events-none fixed inset-x-0 -top-1 z-30 h-[calc(env(safe-area-inset-top)+0.75rem)]"
      />
      <div
        aria-hidden
        className="app-shell-top-fade pointer-events-none fixed inset-x-0 top-0 z-20 h-[calc(env(safe-area-inset-top)+2.75rem)]"
      />
      <div className="app-shell-side-fade mx-auto w-full max-w-md flex-1 min-h-0">
        <main className="h-full px-4 pt-0">
          {children}
        </main>
      </div>
      <ReleaseUpdateModal />
      <AppUpdateAvailableModal />
      <BottomNav activeTab={activeTab} onChange={onTabChange} />
    </div>
  );
}
