import { useState } from 'react';

interface Props {
  onInsert: (amount: number, note?: string) => Promise<{ error?: string }>;
}

export function ManualLogForm({ onInsert }: Props) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (n <= 0 || n > 1_000_000) {
      setErrorMsg('Amount must be between 1 and 1,000,000');
      setStatus('error');
      return;
    }
    setStatus('saving');
    const { error } = await onInsert(n, note.trim() || undefined);
    if (error) { setErrorMsg(error); setStatus('error'); }
    else { setAmount(''); setNote(''); setStatus('idle'); }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <span className="text-xs text-ink-muted uppercase tracking-widest">Manual entry</span>
      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          max="1000000"
          required
          placeholder="Amount (฿)"
          value={amount}
          onChange={e => { setAmount(e.target.value); setStatus('idle'); }}
          className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-ink text-sm placeholder:text-ink-dim outline-none focus:border-terracotta"
        />
        <button
          type="submit"
          disabled={status === 'saving'}
          className="bg-terracotta text-white rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50"
        >
          {status === 'saving' ? '…' : 'Log'}
        </button>
      </div>
      <input
        type="text"
        maxLength={140}
        placeholder="Note (optional)"
        value={note}
        onChange={e => setNote(e.target.value)}
        className="bg-surface border border-border rounded-lg px-4 py-3 text-ink text-sm placeholder:text-ink-dim outline-none focus:border-terracotta"
      />
      {note.length > 0 && (
        <span className="text-xs text-ink-dim text-right">{note.length}/140</span>
      )}
      {status === 'error' && <p className="text-red-500 text-xs">{errorMsg}</p>}
    </form>
  );
}
