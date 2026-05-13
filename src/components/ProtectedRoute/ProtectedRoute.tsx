import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Spinner } from '../Spinner/Spinner';

/**
 * Gate that wraps every authenticated route. Signed-out users go to
 * `/login` so the protected app shell does not try to load room data
 * before Supabase has a real session.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { session, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session || !user) return <Navigate to="/login" replace state={{ from: location }} />;

  return <>{children}</>;
}
