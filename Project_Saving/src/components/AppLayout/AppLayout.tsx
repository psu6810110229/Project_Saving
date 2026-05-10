import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { TabBar } from '../TabBar/TabBar';
import { RoomProvider } from '../RoomContext/RoomContext';
import { RoomsLoader } from './RoomsLoader';
import { WelcomeModal } from '../Modal/WelcomeModal';

interface Props {
  children: ReactNode;
}

export function AppLayout({ children }: Props) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-terracotta border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return (
    <RoomProvider>
      <RoomsLoader />
      
      {/* Global Dynamic Animated Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
        <div className="absolute -top-[10%] -left-[10%] w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] rounded-full bg-terracotta/40 blur-[100px] animate-pulse" style={{ animationDuration: '5s' }} />
        <div className="absolute top-[30%] -right-[10%] w-[50vw] h-[50vw] max-w-[400px] max-h-[400px] rounded-full bg-purple-600/30 blur-[100px] animate-pulse" style={{ animationDuration: '7s', animationDelay: '1s' }} />
        <div className="absolute -bottom-[20%] left-[20%] w-[70vw] h-[70vw] max-w-[600px] max-h-[600px] rounded-full bg-blue-500/20 blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>

      <div className="relative z-0 min-h-screen pb-24">{children}</div>
      <TabBar />
      
      {/* Show welcome modal for new users */}
      {session && !session.user?.user_metadata?.has_completed_onboarding && (
        <WelcomeModal open={true} onClose={() => {}} />
      )}
    </RoomProvider>
  );
}
