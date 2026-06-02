import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  addNativePushActionListener,
  isNativeAndroidPush,
  readNativePushPermission,
  registerNativePush,
} from '../../lib/nativePush';

export function NativePushBootstrap() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeAndroidPush()) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void addNativePushActionListener(target => navigate(target))
      .then(handle => {
        if (cancelled) {
          handle?.remove();
          return;
        }
        cleanup = handle ? () => handle.remove() : null;
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [navigate]);

  useEffect(() => {
    if (!isNativeAndroidPush() || !user) return;

    let cancelled = false;
    void readNativePushPermission()
      .then(permission => {
        if (cancelled || permission !== 'granted') return;
        return registerNativePush();
      })
      .catch(error => {
        console.warn('[NativePushBootstrap] native push refresh failed', error);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
}
