import { useAuth } from '../hooks/useAuth';

/**
 * Sign-in landing page. Visual shell is intentionally minimal — the final
 * brand treatment will land alongside the Dashboard in Step 7 once the
 * atoms / molecules from Steps 5–6 are available.
 */
export function Login() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      <div className="surface-raised w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-6 animate-fade-in-up">
        <span className="font-mono text-brand-800 text-base tracking-widest uppercase">
          GO-OUT
        </span>
        <h1 className="text-2xl text-center">Save together. Win together.</h1>
        <p className="text-sm text-ink-muted text-center">
          Sign in to keep growing your shared vault.
        </p>

        <button
          onClick={signInWithGoogle}
          className="
            w-full rounded-pill bg-brand-800 text-ink-inverse
            px-5 py-3 text-sm font-bold tracking-wide
            shadow-soft hover:shadow-haloOrange
            active:scale-[0.99] transition-all
            flex items-center justify-center gap-3
          "
        >
          <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden>
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
