import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { TabBar } from '../TabBar/TabBar';
import { RoomProvider } from '../RoomContext/RoomContext';
import { RoomsLoader } from './RoomsLoader';

interface Props {
  children: ReactNode;
}

export function AppLayout({ children }: Props) {
  const { session, loading } = useAuth();

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
      <div className="pb-24">{children}</div>
      <TabBar />
    </RoomProvider>
  );
}
