import { memo } from 'react';
import { IconEdit, IconPiggyBank, IconTrendingUp } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';
import Pressable from '../Pressable/Pressable';
import { useAnimatedNumbers } from '../../hooks/useAnimatedNumber';

interface TotalVaultCardProps {
  saved: number;
  target: number;
  onEdit?: () => void;
  editAriaLabel?: string;
  cardholderNames?: string[];
  validThru?: string | null;
}

function formatValidThru(date?: string | null): string | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!m) return null;
  return `${m[2]}/${m[1].slice(2)}`;
}

export const TotalVaultCard = memo(function TotalVaultCard({ saved, target, onEdit, editAriaLabel, cardholderNames, validThru }: TotalVaultCardProps) {
  const { copy } = useI18n();
  const pct = target > 0 ? (saved / target) * 100 : 0;
  const [animSaved, animTarget, animPct] = useAnimatedNumbers([saved, target, pct]);
  const pctRounded = Math.round(animPct);
  const clamped = Math.max(0, Math.min(100, animPct));

  const card = (
    <div className="vault-card-frame">
      <section className="vault-credit-card flex flex-col rounded-2xl px-4 py-3 text-white min-[390px]:px-5 min-[390px]:py-4">
        <div className="relative z-10 flex items-center justify-between gap-2">
          <h2 className="block font-mono text-sm font-bold leading-tight text-white drop-shadow-[0_1px_8px_rgba(95,36,23,0.28)]">
            {copy.dashboard.recordedVault}
          </h2>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full border border-white/25 bg-white/40 px-3 py-1.5 font-mono text-sm font-bold tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-sm"
              aria-label={`${pctRounded}%`}
            >
              {pctRounded}%
            </span>
            {onEdit && (
              <IconButton
                variant="glass"
                size="sm"
                ariaLabel={editAriaLabel ?? 'Edit'}
                onClick={e => { e.stopPropagation(); onEdit?.(); }}
                className="h-7 w-7"
              >
                <IconEdit size={16} />
              </IconButton>
            )}
          </div>
        </div>

        <div className="relative z-10 mt-2 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold tabular-nums drop-shadow-[0_1px_10px_rgba(95,36,23,0.5)]">{formatCurrency(Math.round(animSaved))}</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-white/80">/ {formatCurrency(Math.round(animTarget))}</span>
        </div>

        <div className="relative z-10 mt-3 h-2.5 w-full overflow-hidden rounded-pill bg-white/[0.35] shadow-[inset_0_1px_2px_rgba(92,40,7,0.35)]">
          <div
            className="h-full rounded-pill bg-white shadow-[0_0_14px_rgba(255,255,255,0.58)] transition-[width] duration-500"
            style={{ width: `${clamped}%` }}
          />
        </div>

        <div className="relative z-10 mt-3 grid grid-cols-2 gap-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/20 bg-white/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              <IconPiggyBank size={18} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[12px] uppercase tracking-wider text-white/68">
                {copy.dashboard.vaultSaved}
              </p>
              <p className="truncate font-mono text-base font-medium tabular-nums text-white/80">
                {formatCurrency(Math.round(animSaved))}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/20 bg-white/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              <IconTrendingUp size={18} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[12px] uppercase tracking-wider text-white/68">
                {copy.dashboard.vaultTarget}
              </p>
              <p className="truncate font-mono text-base font-medium tabular-nums text-white/80">
                {formatCurrency(Math.round(animTarget))}
              </p>
            </div>
          </div>
        </div>

        {(cardholderNames?.length || validThru) && (
          <div className="relative z-10 mt-auto flex items-end justify-between gap-4 pt-3 min-[390px]:gap-5 min-[390px]:pt-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase leading-none tracking-[0.18em] text-white/55">
                Cardholders
              </p>
              <p className="mt-1.5 truncate font-mono text-[11px] font-semibold uppercase leading-none tracking-wide text-white/85 min-[390px]:mt-2">
                {(() => {
                  const names = cardholderNames ?? [];
                  if (names.length <= 3) return names.join(' • ');
                  return `${names.slice(0, 3).join(' • ')} +${names.length - 3}`;
                })()}
              </p>
            </div>
            {formatValidThru(validThru) && (
              <div className="shrink-0 text-right">
                <p className="font-mono text-[10px] uppercase leading-none tracking-[0.18em] text-white/55">
                  Valid thru
                </p>
                <p className="mt-1.5 font-mono text-xs font-semibold leading-none tabular-nums text-white/85 min-[390px]:mt-2">
                  {formatValidThru(validThru)}
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );

  if (onEdit) {
    return <Pressable onClick={onEdit}>{card}</Pressable>;
  }

  return card;
});
