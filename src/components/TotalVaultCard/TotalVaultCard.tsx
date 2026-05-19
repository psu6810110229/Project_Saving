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
    <section className="vault-credit-card rounded-2xl p-5 text-white">
      <div className="pointer-events-none absolute -left-16 -top-14 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-28 w-28 rounded-full bg-orange-100/14 blur-2xl" />
      <div className="relative z-10 flex items-center justify-between gap-2">
        <h2 className="block font-mono text-sm font-bold leading-tight text-white drop-shadow-[0_1px_8px_rgba(95,36,23,0.28)]">
          {copy.dashboard.recordedVault}
        </h2>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full border border-white/25 bg-white/[0.18] px-3 py-1.5 font-mono text-xs font-bold tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-md"
            aria-label={`${pctRounded}%`}
          >
            {pctRounded}%
          </span>
          {onEdit && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onEdit?.(); }}
              aria-label={editAriaLabel}
              className="grid h-7 w-7 place-items-center rounded-full border border-white/25 bg-white/[0.18] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-md transition-transform hover:bg-white/30 active:scale-95"
            >
              <IconEdit size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-3 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold tabular-nums drop-shadow-[0_1px_10px_rgba(95,36,23,0.34)]">{formatCurrency(saved)}</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-white/78">/ {formatCurrency(target)}</span>
      </div>

      <div className="relative z-10 mt-3 h-2 w-full overflow-hidden rounded-pill bg-white/[0.22] shadow-[inset_0_1px_2px_rgba(92,40,7,0.2)]">
        <div
          className="h-full rounded-pill bg-white shadow-[0_0_14px_rgba(255,255,255,0.58)] transition-[width] duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>

      <div className="relative z-10 mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/20 bg-white/[0.16] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md">
            <IconPiggyBank size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/68">
              {copy.dashboard.vaultSaved}
            </p>
            <p className="truncate font-mono text-base font-bold tabular-nums">
              {formatCurrency(saved)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/20 bg-white/[0.16] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md">
            <IconTrendingUp size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/68">
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
