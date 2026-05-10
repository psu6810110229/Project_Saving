import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    const { error } = await signInWithEmail(email);
    if (error) {
      setErrorMsg(error);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl text-ink font-semibold mb-1">Project Saving</h1>
        <p className="text-ink-muted text-sm mb-8">Fan & Art — Japan 2027</p>

        {status === 'sent' ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center">
            <p className="text-ink font-medium mb-1">Check your email</p>
            <p className="text-ink-muted text-sm">We sent a magic link to <span className="text-ink">{email}</span></p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-ink text-sm placeholder:text-ink-dim outline-none focus:border-terracotta"
            />
            {status === 'error' && (
              <p className="text-red-500 text-xs">{errorMsg}</p>
            )}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="bg-terracotta text-white rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {status === 'loading' ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
