import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { LoadingState } from '../components/LoadingState/LoadingState';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useI18n } from '../i18n/useI18n';
import { supabase } from '../lib/supabase';

const CALLBACK_TIMEOUT_MS = 12_000;

export function AuthCallback() {
  const navigate = useNavigate();
  const { copy } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const loading = error === null;
  const { shouldShowLoader, fakeLoadingExpired } = useLoadingGate({ loading });

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const providerError = params.get('error_description') ?? params.get('error') ?? hashParams.get('error_description') ?? hashParams.get('error');

      if (providerError) {
        setError(providerError);
        return;
      }

      try {
        const code = params.get('code');
        if (code) {
          const { error: exchangeError } = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            CALLBACK_TIMEOUT_MS,
            copy.auth.timeoutError,
          );
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          CALLBACK_TIMEOUT_MS,
          copy.auth.timeoutError,
        );
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error(copy.auth.noSessionError);

        if (!cancelled) navigate('/', { replace: true });
      } catch (caught) {
        if (!cancelled) {
          const message = caught instanceof Error ? caught.message : copy.auth.genericError;
          setError(message);
        }
      }
    }

    void finishSignIn();

    return () => {
      cancelled = true;
    };
  }, [copy.auth.genericError, copy.auth.noSessionError, copy.auth.timeoutError, navigate]);

  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6">
        <section className="w-full max-w-sm rounded-xl bg-surface p-6 text-center shadow-soft">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-800">{copy.auth.callbackSection}</p>
          <h1 className="mt-3 font-mono text-2xl font-bold text-ink">{copy.auth.callbackErrorTitle}</h1>
          <p className="mt-2 font-mono text-xs leading-5 text-ink-muted">{error}</p>
          <Button className="mt-5" variant="action" fullWidth onClick={() => navigate('/login', { replace: true })}>
            {copy.auth.callbackBackToLogin}
          </Button>
        </section>
      </div>
    );
  }

  if (shouldShowLoader) {
    return (
      <LoadingState
        variant="fullscreen"
        label={copy.common.loading}
        title={copy.auth.callbackSection}
        messages={copy.common.loadingMessages}
        slow={fakeLoadingExpired}
        slowMessage={copy.common.loadingSlow}
      />
    );
  }

  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, ms);

    promise.then(
      value => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      reason => {
        window.clearTimeout(timeoutId);
        reject(reason);
      },
    );
  });
}
