import type { ReactNode } from 'react';
import type { WidgetSnapshot } from '../../lib/widgetSnapshot';
import { palette } from '../../lib/theme';
import { IconFire, IconPiggyBank, IconPlus } from '../Icon/Icon';

type WidgetSize = '2x2' | '4x2';

interface SavingsWidgetProps extends Partial<WidgetSnapshot> {
  size?: WidgetSize;
  className?: string;
  fluid?: boolean;
}

const defaultSnapshot: WidgetSnapshot = {
  roomName: 'GO-OUT',
  saved: 1600,
  goal: 70000,
  progressPct: 3,
  todayDue: 160,
  todayState: 'due',
  todayPeriod: 'day',
  focusBucketName: 'Flights',
  focusBucketCount: 1,
  focusBucketSaved: 1900,
  focusBucketTarget: 30000,
  focusBucketPct: 6,
  streak: 7,
  streakUnit: 'day',
  hasLoggedToday: false,
  updatedAt: new Date().toISOString(),
};

function baht(n: number): string {
  return `฿${Math.round(n).toLocaleString('en-US')}`;
}

function periodLabel(period: WidgetSnapshot['todayPeriod']): string {
  if (period === 'week') return 'ต้องเก็บสัปดาห์นี้';
  if (period === 'month') return 'ต้องเก็บเดือนนี้';
  return 'ต้องเก็บวันนี้';
}

function periodNoun(period: WidgetSnapshot['todayPeriod']): string {
  if (period === 'week') return 'สัปดาห์นี้';
  if (period === 'month') return 'เดือนนี้';
  return 'วันนี้';
}

function streakLabel(streak: number, unit: WidgetSnapshot['streakUnit']): string {
  if (unit === 'week') return `${streak}w`;
  if (unit === 'month') return `${streak}m`;
  return `${streak}d`;
}

function progressLine(saved: number, goal: number): string {
  if (goal <= 0) return baht(saved);
  return `${baht(saved)} จาก ${baht(goal)}`;
}

function supportLine(snapshot: WidgetSnapshot): string {
  if (snapshot.todayState === 'due') {
    if (snapshot.focusBucketName) {
      return snapshot.focusBucketCount > 1
        ? `${snapshot.focusBucketName} +${snapshot.focusBucketCount - 1}`
        : snapshot.focusBucketName;
    }
    if (snapshot.streak > 0) return streakLabel(snapshot.streak, snapshot.streakUnit);
    return progressLine(snapshot.saved, snapshot.goal);
  }
  if (snapshot.todayState === 'done') {
    if (snapshot.streak > 0) return streakLabel(snapshot.streak, snapshot.streakUnit);
    return 'ครบเป้ารอบนี้แล้ว';
  }
  return progressLine(snapshot.saved, snapshot.goal);
}

function bucketProgressLine(snapshot: WidgetSnapshot): string | null {
  if (!snapshot.focusBucketName || snapshot.focusBucketTarget <= 0) return null;
  return `${snapshot.focusBucketName} | ${Math.round(snapshot.focusBucketSaved).toLocaleString('en-US')}/${Math.round(snapshot.focusBucketTarget).toLocaleString('en-US')} (${snapshot.focusBucketPct}%)`;
}

function SmallButton({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <div className="flex h-9 items-center justify-center gap-1.5 rounded-[14px] bg-brand-500 px-3 font-mono text-xs font-bold text-white shadow-haloOrange">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StatusChip({ text }: { text: string }) {
  return (
    <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/75 px-2.5 py-1 font-mono text-[11px] font-bold text-brand-800">
      <IconFire size={12} className="shrink-0 text-brand-500" />
      <span className="truncate">{text}</span>
    </div>
  );
}

function LargeWidget({ snapshot, fluid }: { snapshot: WidgetSnapshot; fluid?: boolean }) {
  const dueMode = snapshot.todayState !== 'no_plan';
  const pct = Math.max(0, Math.min(100, snapshot.progressPct));
  const heroText = snapshot.todayState === 'done'
    ? 'ครบแล้ว'
    : snapshot.todayState === 'due'
      ? baht(snapshot.todayDue)
      : baht(snapshot.saved);
  const subLabel = snapshot.todayState === 'done'
    ? periodNoun(snapshot.todayPeriod)
    : snapshot.todayState === 'due'
      ? periodLabel(snapshot.todayPeriod)
      : 'ยอดสะสม';

  return (
    <div className={`flex flex-col gap-2.5 rounded-[30px] bg-gradient-to-br from-[#FBF1E7] via-[#F7EBDD] to-[#EFDCC8] p-4 ${fluid ? 'h-full w-full' : 'w-full max-w-[388px]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[12px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            {snapshot.roomName}
          </p>
          <div className="mt-1 flex items-end gap-2">
            <p className="font-mono text-[30px] font-bold leading-none text-ink">{heroText}</p>
            <p className="relative -top-[1px] truncate font-mono text-[12px] font-medium leading-none text-brand-800">{subLabel}</p>
          </div>
        </div>
        {snapshot.streak > 0 && <StatusChip text={streakLabel(snapshot.streak, snapshot.streakUnit)} />}
      </div>

      <div className="rounded-[22px] bg-white/70 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">
              {dueMode ? 'ภาพรวม' : 'ความคืบหน้า'}
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold leading-none text-ink">
              {progressLine(snapshot.saved, snapshot.goal)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[11px] font-bold text-brand-800">{pct}%</p>
            <p className="mt-1 font-mono text-[11px] text-ink-muted">{supportLine(snapshot)}</p>
          </div>
        </div>

        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#E8D6C6]">
          <div
            className="h-full rounded-full bg-brand-500"
            style={{ width: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function CompactWidget({ snapshot, fluid }: { snapshot: WidgetSnapshot; fluid?: boolean }) {
  const pct = Math.max(0, Math.min(100, snapshot.progressPct));
  const heroText = snapshot.todayState === 'done'
    ? 'ครบแล้ว'
    : snapshot.todayState === 'due'
      ? baht(snapshot.todayDue)
      : baht(snapshot.saved);
  const label = snapshot.todayState === 'done'
    ? periodNoun(snapshot.todayPeriod)
    : snapshot.todayState === 'due'
      ? periodLabel(snapshot.todayPeriod)
      : 'ยอดสะสม';
  const bucketLine = bucketProgressLine(snapshot);

  return (
    <div className={`flex flex-col rounded-[28px] bg-gradient-to-br from-[#FBF1E7] via-[#F7EBDD] to-[#EFDCC8] p-4 shadow-[0_14px_32px_rgba(45,20,7,0.26)] ${fluid ? 'h-full w-full' : 'w-[180px]'}`}>
      <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
        {snapshot.roomName}
      </p>
      <div className="mt-3 flex items-end gap-2">
        <p className="font-mono text-[28px] font-bold leading-none text-ink">{heroText}</p>
        <p className="relative -top-[1px] truncate font-mono text-[11px] font-medium leading-none text-brand-800">{label}</p>
      </div>
      <p className="mt-2 truncate font-mono text-[11px] text-ink-muted">
        {bucketLine ?? supportLine(snapshot)}
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E8D6C6]">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-4">
        <SmallButton label="เติม" icon={<IconPlus size={13} className="text-white" />} />
      </div>
    </div>
  );
}

export function SavingsWidget({
  size = '4x2',
  className = '',
  fluid = false,
  ...overrides
}: SavingsWidgetProps) {
  const snapshot: WidgetSnapshot = { ...defaultSnapshot, ...overrides };

  return (
    <div
      className={`${className} ${fluid ? 'h-full w-full' : ''}`}
      data-widget-project={snapshot.roomName}
      data-widget-amount={Math.round(snapshot.saved)}
      data-widget-progress={Math.round(snapshot.progressPct)}
      style={{ color: palette.ink }}
    >
      {size === '2x2' ? <CompactWidget snapshot={snapshot} fluid={fluid} /> : <LargeWidget snapshot={snapshot} fluid={fluid} />}
    </div>
  );
}

export function SavingsWidgetPreviewCard({
  title,
  size,
  ...props
}: SavingsWidgetProps & { title: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
        <IconPiggyBank size={12} className="text-[#ffb26b]" />
        <span>{title}</span>
      </div>
      <SavingsWidget size={size} {...props} />
    </div>
  );
}
