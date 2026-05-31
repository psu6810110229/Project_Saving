import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

/**
 * Routes native deep links (Android home-screen widget, external links) into
 * the in-app router. The widget fires a custom-scheme URL such as
 *   goout://dashboard?action=deposit
 * which arrives via Capacitor's `appUrlOpen` event. We translate it to the
 * matching in-app path (e.g. /dashboard?action=deposit) and navigate there,
 * where Dashboard's query-param handler opens the right sheet.
 *
 * No-op on the web: the listener simply never fires outside a native shell.
 */
export function DeepLinkListener() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = CapApp.addListener('appUrlOpen', ({ url }) => {
      try {
        const parsed = new URL(url);
        // goout://dashboard?action=deposit -> host 'dashboard', no pathname
        // goout://auth/callback?code=... -> host 'auth', pathname '/callback'
        const path = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, '');
        // The OAuth redirect returns through the system browser; dismiss it.
        if (path.startsWith('auth/callback')) {
          void Browser.close().catch(() => {});
        }
        navigate(`/${path}${parsed.search}`);
      } catch {
        // Ignore malformed URLs.
      }
    });

    return () => {
      void handle.then(listener => listener.remove());
    };
  }, [navigate]);

  return null;
}
