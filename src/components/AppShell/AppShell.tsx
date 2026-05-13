import type { ReactNode } from 'react';
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
    <div className="min-h-[100dvh] bg-bg text-ink">
      <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),0.5rem)] z-30 flex justify-end px-4">
        <div className="mx-auto flex w-full max-w-md justify-end">
          <VersionChip />
        </div>
      </div>
      <main className="mx-auto max-w-md px-4 pt-10 pb-32">
        {children}
      </main>
      <ReleaseUpdateModal />
      <BottomNav activeTab={activeTab} onChange={onTabChange} />
    </div>
  );
}
