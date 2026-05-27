import { IconX } from '../Icon/Icon';

interface HeroCardDepositProps {
  open: boolean;
  focusBucketName?: string | null;
  amountLabel?: string | null;
  onClose: () => void;
}

export function HeroCardDeposit({
  open,
  focusBucketName,
  amountLabel,
  onClose,
}: HeroCardDepositProps) {
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

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <div className="min-w-0 rounded-lg bg-white/10 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
            Bucket
          </p>
          <p className="mt-1 truncate font-mono text-xs font-bold text-white">
            {focusBucketName ?? 'Focus bucket'}
          </p>
        </div>
        <div className="min-w-[5.5rem] rounded-lg bg-white/10 px-3 py-2 text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/55">
            Amount
          </p>
          <p className="mt-1 truncate font-mono text-xs font-bold tabular-nums text-white">
            {amountLabel ?? '--'}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled
        className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-pill bg-white/80 px-4 font-mono text-xs font-bold uppercase text-[#6F2B1E] opacity-60"
      >
        Confirm
      </button>
    </div>
  );
}
