import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { IconCamera, IconCheckCircle, IconPiggyBank, IconX } from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { cleanQuickAmounts, resolveDepositAmount, sanitizeDepositAmount } from '../../lib/deposit';
import { useI18n } from '../../i18n/useI18n';

export interface HeroDepositBucket {
  id: string;
  icon: ReactNode;
  name: string;
  saved: number;
  target: number;
}

interface HeroCardDepositProps {
  open: boolean;
  buckets: HeroDepositBucket[];
  initialBucketId?: string | null;
  suggestedAmount?: number | null;
  quickAmounts: number[];
  onConfirm: (bucketId: string, amount: number, slip: File | null) => Promise<{ error?: string }>;
  onClose: () => void;
}

export function HeroCardDeposit({
  open,
  buckets,
  initialBucketId,
  suggestedAmount,
  quickAmounts,
  onConfirm,
  onClose,
}: HeroCardDepositProps) {
  const { copy } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openedRef = useRef(false);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<number | null>(null);
  const [amountValue, setAmountValue] = useState('');
  const [slip, setSlip] = useState<File | null>(null);
  const [showSlip, setShowSlip] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanedQuickAmounts = useMemo(() => cleanQuickAmounts(quickAmounts), [quickAmounts]);
  const selectedBucket = buckets.find(bucket => bucket.id === selectedBucketId) ?? buckets[0] ?? null;
  const amount = resolveDepositAmount(amountValue, selectedQuickAmount);

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    const fallbackBucketId = buckets[0]?.id ?? null;
    const nextBucketId = initialBucketId && buckets.some(bucket => bucket.id === initialBucketId)
      ? initialBucketId
      : fallbackBucketId;
    setSelectedBucketId(nextBucketId);
    setSelectedQuickAmount(null);
    setAmountValue(suggestedAmount != null && suggestedAmount > 0 ? String(Math.round(suggestedAmount)) : '');
    setSlip(null);
    setShowSlip(false);
    setSaving(false);
    setSuccess(false);
    setError(null);
  }, [open, buckets, initialBucketId, suggestedAmount]);

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    setAmountValue(sanitizeDepositAmount(event.target.value));
    setSelectedQuickAmount(null);
  }

  function handleQuickAmountSelect(nextAmount: number) {
    setSelectedQuickAmount(nextAmount);
    setAmountValue('');
  }

  async function handleSubmit() {
    if (!selectedBucket || amount <= 0) {
      setError(copy.addMoney.validationNoBucket);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onConfirm(selectedBucket.id, amount, slip);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    window.setTimeout(onClose, 620);
  }

  if (!open) return null;

  return (
    <div className="relative z-10 mt-3 rounded-xl border border-white/15 bg-white/12 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-mono text-xs font-bold uppercase text-white/85">
          Deposit
        </p>
        <button
          type="button"
          aria-label="Close deposit"
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <IconX size={15} />
        </button>
      </div>

      {success ? (
        <div className="mt-4 flex min-h-36 flex-col items-center justify-center rounded-xl bg-white/12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#6F2B1E] shadow-[0_0_24px_rgba(255,255,255,0.42)]">
            <IconCheckCircle size={25} />
          </span>
          <p className="mt-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white">
            {copy.addMoney.outcomeTitle}
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {buckets.map(bucket => (
              <button
                key={bucket.id}
                type="button"
                onClick={() => setSelectedBucketId(bucket.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-pill px-3 py-2 font-mono text-[11px] font-bold transition ${
                  bucket.id === selectedBucket?.id
                    ? 'bg-white text-[#6F2B1E] shadow-[0_8px_22px_-14px_rgba(255,255,255,0.9)]'
                    : 'bg-white/10 text-white/78 hover:bg-white/16'
                }`}
              >
                <span className={bucket.id === selectedBucket?.id ? 'text-[#6F2B1E]' : 'text-white'}>
                  {bucket.icon}
                </span>
                <span className="max-w-[8rem] truncate">{bucket.name}</span>
              </button>
            ))}
          </div>

          <label className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 focus-within:border-white/50">
            <span className="text-white/70">
              <IconPiggyBank size={16} />
            </span>
            <input
              value={amountValue}
              inputMode="numeric"
              placeholder="1200"
              onChange={handleAmountChange}
              className="min-w-0 flex-1 bg-transparent font-mono text-sm font-bold tabular-nums text-white outline-none placeholder:text-white/38"
            />
          </label>

          {cleanedQuickAmounts.length > 0 && (
            <div className="grid grid-cols-2 gap-2 min-[390px]:grid-cols-4">
              {cleanedQuickAmounts.map(quickAmount => (
                <button
                  key={quickAmount}
                  type="button"
                  onClick={() => handleQuickAmountSelect(quickAmount)}
                  className={`h-9 rounded-pill px-2 font-mono text-[11px] font-bold tabular-nums transition ${
                    selectedQuickAmount === quickAmount
                      ? 'bg-white text-[#6F2B1E]'
                      : 'bg-white/10 text-white/80 hover:bg-white/16'
                  }`}
                >
                  +{formatCurrency(quickAmount)}
                </button>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={event => setSlip(event.target.files?.[0] ?? null)}
          />
          <div className="rounded-xl bg-white/10 p-2">
            <button
              type="button"
              onClick={() => {
                setShowSlip(current => {
                  const next = !current;
                  if (next) window.setTimeout(() => fileInputRef.current?.click(), 0);
                  return next;
                });
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left font-mono text-[11px] font-bold text-white/82"
            >
              <span className="inline-flex items-center gap-2">
                <IconCamera size={15} />
                {slip ? copy.addMoney.slipAttached : copy.addMoney.slipLabel}
              </span>
              {slip && (
                <span className="max-w-[9rem] truncate text-white/58">
                  {slip.name}
                </span>
              )}
            </button>
            {showSlip && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 flex-1 rounded-pill bg-white/10 px-3 font-mono text-[11px] font-bold text-white/82"
                >
                  {copy.addMoney.slipTapToAttach}
                </button>
                {slip && (
                  <button
                    type="button"
                    aria-label={copy.addMoney.slipRemoveAriaLabel}
                    onClick={() => setSlip(null)}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/75"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-white/12 px-3 py-2 font-mono text-[11px] font-bold text-white">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={saving || !selectedBucket || amount <= 0}
            onClick={handleSubmit}
            className="inline-flex h-10 w-full items-center justify-center rounded-pill bg-white px-4 font-mono text-xs font-bold uppercase text-[#6F2B1E] transition active:scale-[0.99] disabled:opacity-55 disabled:active:scale-100"
          >
            {saving ? copy.savingPlan.savingButton : copy.addMoney.confirmDepositButton}
          </button>
        </div>
      )}
    </div>
  );
}
