import { useState } from 'react';
import { Modal } from '../Modal/Modal';
import { formatCurrency } from '../../lib/format';
import type { Bucket } from '../../types';
import type { LeaderboardState } from '../../hooks/useLeaderboard';

const PRESETS = [100, 500, 1000];

interface Props {
  open: boolean;
  onClose: () => void;
  bucket: Bucket | null;
  onInsert: (amount: number, bucketId: string, note?: string) => Promise<{ error?: string }>;
  leaderboardState: LeaderboardState;
}

export function LogAmountModal({ open, onClose, bucket, onInsert, leaderboardState }: Props) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Calculate competitive nudge
  let gapMsg = '';
  if (!leaderboardState.loading && leaderboardState.entries.length > 0) {
    const myEntry = leaderboardState.entries.find(e => e.isYou);
    if (myEntry) {
      const targetEntry = leaderboardState.entries.find(e => e.rank === myEntry.rank - 1);
      if (targetEntry) {
        const diff = targetEntry.saved - myEntry.saved;
        if (diff > 0) {
          gapMsg = `Add ${formatCurrency(diff)} more to overtake ${targetEntry.displayName}!`;
        }
      }
    }
  }

  function handleAmountChange(val: string) {
    setAmount(val);
    setStatus('idle');
    setErrorMsg('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bucket) return;

    const n = Number(amount);
    if (n <= 0 || n > 1_000_000) {
      setErrorMsg('Amount must be between 1 and 1,000,000');
      setStatus('error');
      return;
    }

    setStatus('saving');
    const { error } = await onInsert(n, bucket.id, note.trim() || undefined);
    
    if (error) {
      setErrorMsg(error);
      setStatus('error');
    } else {
      // Success
      setAmount('');
      setNote('');
      setStatus('idle');
      onClose();
    }
  }

  // Set amounts using quick presets
  function handlePreset(val: number) {
    setAmount(val.toString());
    setStatus('idle');
    setErrorMsg('');
  }

  // Reset state when closed/opened
  if (!open || !bucket) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Log to ${bucket.name}`}>
      <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
        
        {/* Input area */}
        <div className="flex flex-col gap-2">
          <input
            type="number"
            min="1"
            max="1000000"
            required
            placeholder="Amount (฿)"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            className="
              bg-surface border-2 border-border rounded-xl px-4 py-4
              text-ink text-base placeholder:text-ink-dim
              outline-none focus:border-terracotta
              transition-colors duration-150 w-full
            "
          />
          {/* Quick presets */}
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePreset(p)}
                className="
                  flex-1 bg-surface border border-border rounded-xl py-2
                  text-sm font-bold text-ink shadow-sm
                  hover:bg-terracotta hover:text-white hover:border-terracotta
                  active:scale-95 transition-all duration-150
                "
              >
                +{formatCurrency(p)}
              </button>
            ))}
          </div>
        </div>

        {/* Note input */}
        <div className="flex flex-col gap-1">
          <input
            type="text"
            maxLength={140}
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="
              bg-surface border-2 border-border rounded-xl px-4 py-3
              text-ink text-sm placeholder:text-ink-dim
              outline-none focus:border-terracotta
              transition-colors duration-150 w-full
            "
          />
          {note.length > 0 && (
            <span className="text-xs text-ink-dim text-right">{note.length}/140</span>
          )}
        </div>

        {/* Error Message */}
        {status === 'error' && <p className="text-red-500 text-xs">{errorMsg}</p>}

        {/* Nudge */}
        {gapMsg && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
            <span className="text-xs text-terracotta font-semibold"> {gapMsg}</span>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={status === 'saving'}
          className="
            mt-2 w-full bg-terracotta text-white rounded-xl py-4
            text-base font-bold shadow-sm
            hover:shadow-md hover:brightness-105
            active:scale-95 disabled:opacity-50
            transition-all duration-150
          "
        >
          {status === 'saving' ? 'Logging...' : 'Log Saving'}
        </button>
      </form>
    </Modal>
  );
}
