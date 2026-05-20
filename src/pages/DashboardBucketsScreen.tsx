/**
 * DashboardBucketsScreen
 * Recreates the buckets/sub-goals view from dashboard-2-reference.png
 * Shows savings categories grid and daily savings trend chart
 */

import { useState } from 'react';
import { appVersion } from '../lib/version';

// Dummy data matching the screenshot
const DUMMY_DATA = {
  buckets: [
    { id: '1', icon: 'plane', name: 'ค่าเครื่อง', saved: 1629, target: 20000, pct: 8 },
    { id: '2', icon: 'bed', name: 'ค่าโรงแรม', saved: 100, target: 8000, pct: 1 },
    { id: '3', icon: 'utensils', name: 'Pocket Money', saved: 0, target: 12000, pct: 0 },
    { id: '4', icon: 'ticket', name: 'กิจกรรม', saved: 0, target: 5000, pct: 0 },
    { id: '5', icon: 'briefcase', name: 'Accessories', saved: 0, target: 3000, pct: 0 },
    { id: '6', icon: 'gift', name: 'ของฝาก', saved: 0, target: 2000, pct: 0 },
  ],
  dailyStats: {
    total: 8092,
    you: 1729,
    partner: 6363,
    days: [
      { label: 'อ', you: 1000, partner: 1000 },
      { label: 'พ', you: 100, partner: 500 },
      { label: 'พฤ', you: 100, partner: 14 },
      { label: 'ศ', you: 100, partner: 15 },
      { label: 'ส', you: 0, partner: 0 },
      { label: 'อา', you: 0, partner: 200 },
      { label: 'จ', you: 0, partner: 200 },
    ],
  },
};

function IconPlane({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}

function IconBed({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v9" />
    </svg>
  );
}

function IconUtensils({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}

function IconTicket({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  );
}

function IconBriefcase({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function IconGift({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

function IconTrendingUp({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function IconPlus({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const BUCKET_ICONS: Record<string, React.FC<{ size?: number }>> = {
  plane: IconPlane,
  bed: IconBed,
  utensils: IconUtensils,
  ticket: IconTicket,
  briefcase: IconBriefcase,
  gift: IconGift,
};

function ProgressBar({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const clamped = Math.max(0, Math.min(100, value));
  const heightClass = size === 'sm' ? 'h-1.5' : 'h-2.5';
  return (
    <div className={`w-full rounded-full bg-well overflow-hidden ${heightClass}`}>
      <div
        className="h-full rounded-full bg-brand-500 transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString()}`;
}

function BucketCard({ bucket }: { bucket: typeof DUMMY_DATA.buckets[0] }) {
  const IconComponent = BUCKET_ICONS[bucket.icon] || IconGift;
  return (
    <div className="rounded-xl bg-surface p-3 shadow-soft flex flex-col items-center text-center">
      <div className="w-full flex justify-end mb-1">
        <span className="font-mono text-[10px] text-brand-500 font-bold">{bucket.pct}%</span>
      </div>
      <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-800 mb-2">
        <IconComponent size={22} />
      </div>
      <p className="font-mono text-sm font-bold text-ink truncate w-full">{bucket.name}</p>
      <p className="font-mono text-xs text-ink-muted mt-0.5">
        {formatCurrency(bucket.saved)} / {formatCurrency(bucket.target)}
      </p>
      <div className="mt-2 w-full">
        <ProgressBar value={bucket.pct} size="sm" />
      </div>
    </div>
  );
}

function DailyTrendChart({ data }: { data: typeof DUMMY_DATA.dailyStats }) {
  const maxValue = Math.max(
    ...data.days.flatMap(d => [d.you, d.partner]),
    1
  );
  const barMaxHeight = 100;

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-soft">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <IconTrendingUp size={20} className="text-brand-500" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">ยอดฝากรายวัน</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-brand-500">{formatCurrency(data.total)}</span>
            <span className="font-mono text-xs text-ink-muted">7 วันที่ผ่านมา</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-brand-500" />
            <span className="font-mono text-xs text-ink-muted">คุณ</span>
            <span className="font-mono text-sm font-bold text-ink">{formatCurrency(data.you)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#4F6382]" />
            <span className="font-mono text-xs text-ink-muted">พี่ที่ร์โบ</span>
            <span className="font-mono text-sm font-bold text-ink">{formatCurrency(data.partner)}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          <div className="border-b border-ink/5" />
          <div className="border-b border-ink/5" />
          <div className="border-b border-ink/5" />
          <div className="border-b border-ink/10" />
        </div>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-right pr-2">
          <span className="font-mono text-[10px] text-ink-muted">1000</span>
          <span className="font-mono text-[10px] text-ink-muted">500</span>
          <span className="font-mono text-[10px] text-ink-muted">0</span>
        </div>

        {/* Bars */}
        <div className="flex items-end justify-around gap-1 pt-2 pb-6 pl-8">
          {data.days.map((day, index) => {
            const youHeight = (day.you / maxValue) * barMaxHeight;
            const partnerHeight = (day.partner / maxValue) * barMaxHeight;
            const isToday = index === data.days.length - 1;

            return (
              <div key={index} className="flex flex-col items-center gap-1 flex-1">
                <div className="flex items-end gap-0.5 h-[100px]">
                  {/* Partner bar */}
                  <div className="relative flex flex-col items-center">
                    {day.partner > 0 && (
                      <span className="font-mono text-[8px] text-[#4F6382] mb-0.5">{day.partner}</span>
                    )}
                    <div
                      className="w-4 rounded-t-full bg-[#4F6382]"
                      style={{ height: `${Math.max(partnerHeight, day.partner > 0 ? 4 : 0)}px` }}
                    />
                  </div>
                  {/* You bar */}
                  <div className="relative flex flex-col items-center">
                    {day.you > 0 && (
                      <span className="font-mono text-[8px] text-brand-500 mb-0.5">{day.you}</span>
                    )}
                    <div
                      className="w-4 rounded-t-full bg-brand-500"
                      style={{ height: `${Math.max(youHeight, day.you > 0 ? 4 : 0)}px` }}
                    />
                  </div>
                </div>
                <span className={`font-mono text-xs ${isToday ? 'font-bold text-brand-500' : 'text-ink-muted'}`}>
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function DashboardBucketsScreen() {
  const [activeTab] = useState<'mine' | 'partner'>('mine');
  const [navTab] = useState<'dashboard' | 'add' | 'profile'>('dashboard');
  const data = DUMMY_DATA;

  return (
    <div className="min-h-screen bg-bg w-full max-w-[390px] mx-auto flex flex-col">
      {/* Version badge */}
      <div className="absolute top-4 right-4">
        <span className="font-mono text-xs text-ink-muted border border-ink/10 rounded-full px-2 py-0.5">v{appVersion()}</span>
      </div>

      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto px-4 pt-12 pb-24">
        {/* Tab Switcher */}
        <div className="flex justify-end mb-4">
          <div className="inline-flex rounded-full bg-surface p-1 shadow-soft">
            <button
              className={`px-4 py-1.5 rounded-full font-mono text-sm font-bold transition-colors ${
                activeTab === 'mine' ? 'bg-brand-500 text-white' : 'text-ink-muted'
              }`}
            >
              คุณ
            </button>
            <button
              className={`px-4 py-1.5 rounded-full font-mono text-sm font-bold transition-colors ${
                activeTab === 'partner' ? 'bg-brand-500 text-white' : 'text-ink-muted'
              }`}
            >
              พี่ที่ร์โบ
            </button>
          </div>
        </div>

        {/* Section Header */}
        <div className="mb-4">
          <h1 className="font-mono text-2xl font-bold text-ink">เป้าหมายย่อย</h1>
          <p className="font-mono text-sm text-ink-muted mt-1">ตอนนี้คุณมี {data.buckets.length} เป้าหมายย่อย</p>
          <button className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 font-mono text-sm font-bold text-white shadow-haloOrange">
            <IconPlus size={18} />
            เพิ่มเป้าหมายย่อย
          </button>
        </div>

        {/* Bucket Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {data.buckets.map((bucket) => (
            <BucketCard key={bucket.id} bucket={bucket} />
          ))}
        </div>

        {/* Daily Trend Chart */}
        <DailyTrendChart data={data.dailyStats} />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-surface border-t border-ink/10 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 px-4">
        <div className="flex items-center justify-around">
          <button className={`flex flex-col items-center gap-0.5 px-6 py-1 ${navTab === 'dashboard' ? 'text-brand-500' : 'text-ink-muted'}`}>
            <IconGrid />
            <span className="font-mono text-[10px] font-bold">หน้าหลัก</span>
          </button>
          <button className={`flex flex-col items-center gap-0.5 px-6 py-1 ${navTab === 'add' ? 'text-brand-500' : 'text-ink-muted'}`}>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-500 text-white -mt-4 shadow-haloOrange">
              <IconPlus size={20} />
            </span>
            <span className="font-mono text-[10px] font-bold text-ink-muted">หยอดเงิน</span>
          </button>
          <button className={`flex flex-col items-center gap-0.5 px-6 py-1 ${navTab === 'profile' ? 'text-brand-500' : 'text-ink-muted'}`}>
            <IconUser />
            <span className="font-mono text-[10px] font-bold">โปรไฟล์</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
