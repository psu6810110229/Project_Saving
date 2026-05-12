import { useAuth } from '../../hooks/useAuth';
import type { ReactNode } from 'react';
import { Login } from '../../pages/Login';
import { Spinner } from '../Spinner/Spinner';

/**
 * Gate that wraps every authenticated route. Previously this redirected
 * a signed-out caller to `/login`, but that meant a user could land on
 * the create-project screen, watch their session expire, and have no
 * obvious way back — the only sign-in button lived on a different URL
 * and they had to manually navigate there. Now we render the Login UI
 * inline at the same URL, so the "Continue with Google" CTA is always
 * one tap away regardless of which protected page the user was on.
 * After OAuth completes, AuthCallback navigates to '/' as before.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session) return <Login />;

  return <>{children}</>;
}
