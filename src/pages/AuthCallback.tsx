import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { Spinner } from '../components/Spinner/Spinner';
import { supabase } from '../lib/supabase';

const CALLBACK_TIMEOUT_MS = 12_000;

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

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
          );
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          CALLBACK_TIMEOUT_MS,
        );
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error('Sign-in finished without a saved session. Please try again.');

        if (!cancelled) navigate('/', { replace: true });
      } catch (caught) {
        if (!cancelled) {
          const message = caught instanceof Error ? caught.message : 'Could not finish sign-in. Please try again.';
          setError(message);
        }
      }
    }

    void finishSignIn();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6">
        <section className="w-full max-w-sm rounded-3xl bg-surface p-6 text-center shadow-soft">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-800">Sign In</p>
          <h1 className="mt-3 font-mono text-2xl font-bold text-ink">Could not finish sign-in</h1>
          <p className="mt-2 font-mono text-xs leading-5 text-ink-muted">{error}</p>
          <Button className="mt-5" variant="action" fullWidth onClick={() => navigate('/login', { replace: true })}>
            Back to Login
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <Spinner />
    </div>
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('Sign-in took too long. Check your connection and try again.'));
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
