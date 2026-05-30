import type { ReactNode } from 'react';
import { AppUpdateAvailableModal } from '../AppUpdateAvailableModal/AppUpdateAvailableModal';
import { BottomNav, type BottomNavTab } from '../BottomNav/BottomNav';
import { ReleaseUpdateModal } from '../ReleaseUpdateModal/ReleaseUpdateModal';

interface AppShellProps {
  activeTab: BottomNavTab;
  onTabChange: (tab: BottomNavTab) => void;
  children: ReactNode;
  /**
   * Whether to render the bottom navigation. Hidden on the focused
   * no-project setup screen so it reads as full-screen onboarding.
   */
  showNav?: boolean;
  showReleaseModal?: boolean;
}

export function AppShell({
  activeTab,
  onTabChange,
  children,
  showNav = true,
  showReleaseModal = false,
}: AppShellProps) {
  return (
    <div className="flex h-[100dvh] flex-col text-ink">
      <div className="mx-auto w-full max-w-md flex-1 min-h-0">
        <main className="h-full pt-0">
          {children}
        </main>
      </div>
      {showReleaseModal && <ReleaseUpdateModal />}
      <AppUpdateAvailableModal />
      {showNav && <BottomNav activeTab={activeTab} onChange={onTabChange} />}
    </div>
  );
}
