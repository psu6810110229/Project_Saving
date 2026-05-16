import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { LoadingState } from '../LoadingState/LoadingState';

/**
 * Gate that wraps every authenticated route. Signed-out users go to
 * `/login` so the protected app shell does not try to load room data
 * before Supabase has a real session.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { session, user, loading } = useAuth();
  const { copy } = useI18n();

  if (loading) {
    return <LoadingState variant="fullscreen" label={copy.common.loading} body={copy.common.loading} />;
  }

  if (!session || !user) return <Navigate to="/login" replace state={{ from: location }} />;

  return <>{children}</>;
}
