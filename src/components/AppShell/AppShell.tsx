import type { ReactNode } from 'react';
import { AppUpdateAvailableModal } from '../AppUpdateAvailableModal/AppUpdateAvailableModal';
import { BottomNav, type BottomNavTab } from '../BottomNav/BottomNav';
import { ReleaseUpdateModal } from '../ReleaseUpdateModal/ReleaseUpdateModal';
import { VersionChip } from '../VersionChip/VersionChip';

interface AppShellProps {
  activeTab: BottomNavTab;
  onTabChange: (tab: BottomNavTab) => void;
  children: ReactNode;
}

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
  return (
    <div className="flex h-[100dvh] flex-col text-ink">
      <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.5rem)] z-30 flex justify-end px-4">
        <div className="mx-auto flex w-full max-w-md justify-end">
          <VersionChip />
        </div>
      </div>
      <main className="mx-auto w-full max-w-md flex-1 min-h-0 px-4 pt-10">
        {children}
      </main>
      <ReleaseUpdateModal />
      <AppUpdateAvailableModal />
      <BottomNav activeTab={activeTab} onChange={onTabChange} />
    </div>
  );
}
