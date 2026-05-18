import { IconEdit, IconPiggyBank, IconTrendingUp } from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';
import Pressable from '../Pressable/Pressable';

interface TotalVaultCardProps {
  saved: number;
  target: number;
  onEdit?: () => void;
  editAriaLabel?: string;
}

export function TotalVaultCard({ saved, target, onEdit, editAriaLabel }: TotalVaultCardProps) {
  const { copy } = useI18n();
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const pctRounded = Math.round(pct);
  const clamped = Math.max(0, Math.min(100, pct));

  const card = (
    <section className="rounded-2xl bg-brand-500 p-5 text-white shadow-haloOrange">
      <div className="flex items-center justify-between gap-2">
        <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white">
          {copy.dashboard.recordedVault}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full bg-white/20 px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums"
            aria-label={`${pctRounded}%`}
          >
            {pctRounded}%
          </span>
          {onEdit && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onEdit?.(); }}
              aria-label={editAriaLabel}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-white transition-transform hover:bg-white/30 active:scale-95"
            >
              <IconEdit size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-bold tabular-nums">{formatCurrency(saved)}</span>
        <span className="font-mono text-sm tabular-nums opacity-80">/ {formatCurrency(target)}</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-white/20">
        <div
          className="h-full rounded-pill bg-white transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/20 text-white">
            <IconPiggyBank size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider opacity-70">
              {copy.dashboard.vaultSaved}
            </p>
            <p className="truncate font-mono text-base font-bold tabular-nums">
              {formatCurrency(saved)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/20 text-white">
            <IconTrendingUp size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider opacity-70">
              {copy.dashboard.vaultTarget}
            </p>
            <p className="truncate font-mono text-base font-bold tabular-nums">
              {formatCurrency(target)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );

  if (onEdit) {
    return <Pressable onClick={onEdit}>{card}</Pressable>;
  }

  return card;
}
