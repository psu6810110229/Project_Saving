import { type ChangeEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import { Button, MODAL_ACTION_ROW_REVERSE_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../Button/Button';
import { IconBubble } from '../IconBubble/IconBubble';
import { IconCheck, IconCheckCircle, IconPiggyBank, IconWarning } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import Pressable from '../Pressable/Pressable';
import { TextInput } from '../TextInput/TextInput';
import { useI18n } from '../../i18n/useI18n';
import { formatCurrency } from '../../lib/format';
import { haptic } from '../../lib/haptics';

export interface AllocateBucketOption {
  id: string;
  name: string;
  saved: number;
  target: number;
  icon: ReactNode;
}

interface AllocateResultShape {
  error?: string;
  errorHint?: string;
  amount?: number;
}

interface AllocateSheetProps {
  open: boolean;
  onClose: () => void;
  /** Unallocated surplus available to place into buckets. */
  pool: number;
  /** Own, active buckets eligible to receive the allocation. */
  buckets: AllocateBucketOption[];
  /** Pre-selected bucket id (from a drag-drop); null opens the picker. */
  initialBucketId?: string | null;
  allocate: (input: { bucketId: string; amount: number; clientRequestId?: string }) => Promise<AllocateResultShape>;
  /** Called after a successful allocation so the caller can refresh. */
  onAllocated?: () => void;
}

type Step = 'form' | 'done';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatAmountInputValue(amount: number): string {
  return round2(amount).toFixed(2).replace(/\.?0+$/, '');
}

/** Default fill for a bucket: up to its remaining-to-target, capped by the pool. */
function defaultAmountFor(bucket: AllocateBucketOption | null, pool: number): string {
  if (!bucket) return '';
  const remaining = Math.max(0, bucket.target - bucket.saved);
  const base = remaining > 0 ? Math.min(pool, remaining) : pool;
  return base > 0 ? formatAmountInputValue(base) : '';
}

function mapHintToErrorKey(hint: string | undefined): 'exceeds' | 'archived' | 'amount' | 'generic' {
  switch (hint) {
    case 'allocation_exceeds_pool': return 'exceeds';
    case 'allocation_bucket_archived': return 'archived';
    case 'allocation_invalid_amount': return 'amount';
    default: return 'generic';
  }
}

/**
 * Allocate-difference sheet (plan 56 §7.2). Places unallocated reconcile
 * surplus into one of the user's own buckets. Opened by a drag-drop with a
 * pre-selected bucket, or tapped open as the accessible fallback (then the
 * user picks a bucket). Mount with a fresh `key` per open so state resets.
 */
export function AllocateSheet({
  open,
  onClose,
  pool,
  buckets,
  initialBucketId,
  allocate,
  onAllocated,
}: AllocateSheetProps) {
  const { copy } = useI18n();
  const a = copy.reconcile.allocate;

  const [selectedId, setSelectedId] = useState<string | null>(
    () => (initialBucketId && buckets.some(b => b.id === initialBucketId)
      ? initialBucketId
      : buckets[0]?.id ?? null),
  );
  const selected = useMemo(() => buckets.find(b => b.id === selectedId) ?? null, [buckets, selectedId]);

  const [step, setStep] = useState<Step>('form');
  const [amountValue, setAmountValue] = useState(() => defaultAmountFor(
    initialBucketId && buckets.some(b => b.id === initialBucketId)
      ? buckets.find(b => b.id === initialBucketId)!
      : buckets[0] ?? null,
    pool,
  ));
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<'exceeds' | 'archived' | 'amount' | 'generic' | null>(null);
  const [completeConfirmed, setCompleteConfirmed] = useState(false);
  const requestIdRef = useRef<string | null>(null);

  const amountNumber = Number(amountValue);
  const amountValid = amountValue.trim().length > 0 && Number.isFinite(amountNumber) && amountNumber > 0;
  const exceedsPool = amountValid && amountNumber > round2(pool) + 0.005;
  const remainingToTarget = selected ? Math.max(0, selected.target - selected.saved) : 0;
  const selectedComplete = Boolean(selected && selected.target > 0 && selected.saved >= selected.target);
  const overTarget = Boolean(selected) && amountValid && (remainingToTarget <= 0 || amountNumber > remainingToTarget + 0.005);
  const poolAfter = Math.max(0, round2(pool - (amountValid ? amountNumber : 0)));
  const canSubmit = Boolean(selected) && amountValid && !exceedsPool && !submitting;

  function handleSelect(id: string) {
    setSelectedId(id);
    setAmountValue(defaultAmountFor(buckets.find(b => b.id === id) ?? null, pool));
    setErrorKey(null);
    setCompleteConfirmed(false);
  }

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value.replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    setAmountValue(parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}` : raw);
    setErrorKey(null);
  }

  async function handleConfirm() {
    if (!selected || !amountValid) {
      setErrorKey('amount');
      return;
    }
    if (exceedsPool) {
      setErrorKey('exceeds');
      return;
    }
    if (selectedComplete && !completeConfirmed) {
      setCompleteConfirmed(true);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setErrorKey(null);
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();

    const result = await allocate({
      bucketId: selected.id,
      amount: amountNumber,
      clientRequestId: requestIdRef.current,
    });
    setSubmitting(false);

    if (result.error) {
      setErrorKey(mapHintToErrorKey(result.errorHint));
      return;
    }
    haptic('success');
    onAllocated?.();
    setStep('done');
  }

  const errorText = errorKey
    ? errorKey === 'exceeds' ? a.errorExceedsPool
      : errorKey === 'archived' ? a.errorBucketArchived
        : errorKey === 'amount' ? a.errorEnterAmount
          : a.errorGeneric
    : null;

  return (
    <Modal
      open={open}
      title={a.sheetTitle(selected?.name ?? '')}
      onClose={onClose}
      headerAccessory={selectedComplete ? (
        <span
          className="grid h-8 w-8 place-items-center rounded-full bg-[#D3FBE6] text-[#16855E] shadow-[0_8px_18px_rgba(22,133,94,0.14)]"
          aria-label={a.completeBadgeLabel}
          title={a.completeBadgeLabel}
        >
          <IconCheckCircle size={18} />
        </span>
      ) : null}
    >
      {step === 'done' ? (
        <section className="flex flex-col items-center gap-4 rounded-xl bg-surface p-5 text-center shadow-soft">
          <IconBubble tone="solid" size="md"><IconCheck size={22} /></IconBubble>
          <div className="flex flex-col gap-1">
            <p className="font-mono text-lg font-semibold text-ink">{a.successTitle}</p>
            <p className="font-mono-th text-sm leading-6 text-ink-muted">
              {a.successBody(formatCurrency(amountNumber), selected?.name ?? '')}
            </p>
          </div>
          <Button variant="action" fullWidth onClick={onClose}>{copy.common.close}</Button>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Pool summary */}
          <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-orange-50 to-brand-50 px-4 py-3 ring-1 ring-brand-200">
            <span className="font-mono-th text-xs font-semibold text-brand-700">{a.surplusLabel}</span>
            <span className="font-mono text-lg font-semibold text-brand-900">{formatCurrency(pool)}</span>
          </div>

          {/* Bucket picker (shown when no preselection, or to change target) */}
          {buckets.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="font-mono-th text-xs font-semibold text-ink-muted">{a.pickBucketTitle}</span>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x">
                {buckets.map(bucket => {
                  const isSelected = bucket.id === selectedId;
                  return (
                    <Pressable
                      key={bucket.id}
                      onClick={() => handleSelect(bucket.id)}
                      className={
                        'flex shrink-0 snap-start flex-col items-start gap-1 rounded-2xl border px-3 py-2.5 text-left transition-all min-w-[140px] '
                        + (isSelected ? 'border-brand-500 bg-brand-50 shadow-soft' : 'border-brand-100 bg-surface hover:border-brand-300')
                      }
                    >
                      <div className="flex w-full items-center gap-2">
                        <IconBubble tone={isSelected ? 'solid' : 'peach'} size="sm">{bucket.icon}</IconBubble>
                        <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-ink">{bucket.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-ink-muted">{formatCurrency(bucket.saved)}</span>
                    </Pressable>
                  );
                })}
              </div>
            </div>
          )}

          {/* Amount */}
          <label className="block">
            <span className="block font-mono-th text-xs font-semibold text-ink-muted">{a.amountLabel}</span>
            <div className="mt-2">
              <TextInput
                inputMode="decimal"
                placeholder="0"
                value={amountValue}
                leadingIcon={<IconPiggyBank size={16} />}
                onChange={handleAmountChange}
                error={exceedsPool}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="font-mono-th text-[11px] text-ink-muted">
                {remainingToTarget > 0 ? a.remainingToTarget(formatCurrency(remainingToTarget)) : a.poolRemaining(formatCurrency(poolAfter))}
              </span>
              {remainingToTarget > 0 && (
                <span className="font-mono-th text-[11px] text-ink-muted">{a.poolRemaining(formatCurrency(poolAfter))}</span>
              )}
            </div>
          </label>

          {overTarget && !exceedsPool && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 font-mono-th text-xs text-brand-700">{a.overTargetWarning}</p>
          )}
          {selectedComplete && (
            <div className="flex gap-3 rounded-xl bg-[#F1FCF6] px-3 py-3 ring-1 ring-[#BFEFD5]">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#D3FBE6] text-[#16855E]">
                <IconWarning size={17} />
              </span>
              <div className="min-w-0">
                <p className="font-mono-th text-sm font-semibold text-ink">{a.completeConfirmTitle}</p>
                <p className="mt-1 font-mono-th text-xs leading-5 text-ink-muted">
                  {a.completeConfirmBody(selected?.name ?? '')}
                </p>
              </div>
            </div>
          )}
          {errorText && (
            <p className="rounded-lg bg-danger-soft px-3 py-2 font-mono-th text-xs text-danger">{errorText}</p>
          )}

          <div className={MODAL_ACTION_ROW_REVERSE_CLASS}>
            <Button variant="action" fullWidth size="md" disabled={!canSubmit} onClick={handleConfirm}>
              {submitting ? a.confirmingButton : selectedComplete && !completeConfirmed ? a.confirmCompleteButton : a.confirmButton}
            </Button>
            <Button variant="ghost" fullWidth size="md" className={MODAL_SECONDARY_BUTTON_CLASS} onClick={onClose}>{a.cancelButton}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
