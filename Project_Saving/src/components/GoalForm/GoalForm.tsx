import { useState } from 'react';
import type { Goal } from '../../types';

interface Props {
  initial: Goal | null;
  onSave: (values: { target_amount: number; start_date: string; end_date: string }) => Promise<{ error?: string }>;
}

export function GoalForm({ initial, onSave }: Props) {
  const [amount, setAmount] = useState(initial ? String(initial.target_amount) : '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = Number(amount);
    if (target <= 0) { setErrorMsg('Amount must be greater than 0'); setStatus('error'); return; }
    if (endDate < startDate) { setErrorMsg('End date must be after start date'); setStatus('error'); return; }
    setStatus('saving');
    const { error } = await onSave({ target_amount: target, start_date: startDate, end_date: endDate });
    if (error) { setErrorMsg(error); setStatus('error'); }
    else setStatus('saved');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-muted uppercase tracking-widest">Target amount (฿)</label>
        <input
          type="number"
          min="1"
          required
          placeholder="e.g. 50000"
          value={amount}
          onChange={e => { setAmount(e.target.value); setStatus('idle'); }}
          className="bg-surface border border-border rounded-lg px-4 py-3 text-ink text-sm placeholder:text-ink-dim outline-none focus:border-terracotta"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-muted uppercase tracking-widest">Start date</label>
        <input
          type="date"
          required
          value={startDate}
          onChange={e => { setStartDate(e.target.value); setStatus('idle'); }}
          className="bg-surface border border-border rounded-lg px-4 py-3 text-ink text-sm outline-none focus:border-terracotta"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-muted uppercase tracking-widest">End date</label>
        <input
          type="date"
          required
          value={endDate}
          onChange={e => { setEndDate(e.target.value); setStatus('idle'); }}
          className="bg-surface border border-border rounded-lg px-4 py-3 text-ink text-sm outline-none focus:border-terracotta"
        />
      </div>

      {status === 'error' && <p className="text-red-500 text-xs">{errorMsg}</p>}
      {status === 'saved' && <p className="text-green-600 text-xs">Goal saved!</p>}

      <button
        type="submit"
        disabled={status === 'saving'}
        className="bg-terracotta text-white rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50"
      >
        {status === 'saving' ? 'Saving…' : 'Save goal'}
      </button>
    </form>
  );
}
