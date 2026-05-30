/**
 * DashboardReferenceScreen
 * Recreates the main savings dashboard from dashboard-reference.png
 * "Japan 2027" trip savings with member progress and saving plan
 */

import { useState } from 'react';

// Dummy data matching the screenshot
const DUMMY_DATA = {
  projectName: 'Japan 2027',
  memberCount: 2,
  totalSaved: 8092,
  totalTarget: 150000,
  pct: 5,
  members: [
    {
      id: '1',
      name: 'พี่เทีร์โบ',
      imageUrl: '/placeholder.svg?height=80&width=80',
      saved: 6363,
      target: 75000,
      pct: 8,
      isLeader: true,
    },
    {
      id: '2',
      name: 'คุณ - FRANVMe',
      imageUrl: '/placeholder.svg?height=80&width=80',
      saved: 1729,
      target: 75000,
      pct: 2,
      isYou: true,
    },
  ],
  savingPlan: {
    status: 'ยังไม่เริ่ม',
    todayGoal: 0,
    daysRemaining: 3,
    progressPct: 5,
  },
  recentCheck: {
    amount: 1629,
    matchStatus: 'ตรงกัน',
    daysAgo: 1,
  },
};

function CrownBadge() {
  return (
    <span className="absolute -top-1 -left-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-white shadow-haloOrange">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M3 18h18l-2-10-4.5 4L12 6l-2.5 6L5 8 3 18Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Avatar({ imageUrl, fallback, size = 'lg', isLeader = false }: { imageUrl?: string; fallback: string; size?: 'md' | 'lg'; isLeader?: boolean }) {
  const sizeClass = size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';
  return (
    <div className="relative inline-flex">
      {isLeader && <CrownBadge />}
      <div
        className={`${sizeClass} rounded-full overflow-hidden bg-brand-100 flex items-center justify-center`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-mono font-bold text-brand-800 text-xl">{fallback}</span>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const clamped = Math.max(0, Math.min(100, value));
  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3.5' : 'h-2.5';
  return (
    <div className={`w-full rounded-full bg-well overflow-hidden ${heightClass}`}>
      <div
        className="h-full rounded-full bg-brand-500 transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
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

function IconPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
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

function IconDots() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function IconReceipt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  );
}

function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString()}`;
}

export function DashboardReferenceScreen() {
  const [activeTab] = useState<'dashboard' | 'add' | 'profile'>('dashboard');
  const data = DUMMY_DATA;

  return (
    <div className="min-h-screen bg-bg w-full max-w-[390px] mx-auto flex flex-col">
      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {/* Header */}
        <header className="flex items-start justify-between mb-4">
          <div>
            <button className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-bold text-ink">{data.projectName}</h1>
              <IconChevronDown />
            </button>
            <div className="mt-1 flex items-center gap-1.5 text-ink-muted">
              <IconUsers />
              <span className="font-mono text-xs">{data.memberCount} คนในห้องนี้</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-soft">
              <IconUsers />
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-soft">
              <IconDots />
            </button>
          </div>
        </header>

        {/* Total Vault Card */}
        <section className="rounded-2xl bg-brand-500 p-5 text-white shadow-haloOrange mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded bg-white/20">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 4h16v16H4z" />
                </svg>
              </span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider">ยอดเงินรวมของทุกคน</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-mono text-xs font-bold">{data.pct}%</span>
              <button className="grid h-7 w-7 place-items-center rounded-full bg-white/20">
                <IconEdit />
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-mono text-4xl font-bold">{formatCurrency(data.totalSaved)}</span>
            <span className="font-mono text-sm opacity-80">/ {formatCurrency(data.totalTarget)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white" style={{ width: `${data.pct}%` }} />
          </div>
          <div className="mt-4 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/20">
                <IconWallet />
              </span>
              <div>
                <p className="font-mono text-[10px] opacity-70">เก็บไปแล้ว</p>
                <p className="font-mono text-base font-bold text-brand-500">{formatCurrency(data.totalSaved)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/20">
                <IconTarget />
              </span>
              <div>
                <p className="font-mono text-[10px] opacity-70">เป้าหมาย</p>
                <p className="font-mono text-base font-bold">{formatCurrency(data.totalTarget)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Member Progress Section */}
        <section className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-base font-bold text-ink">ความคืบหน้าของทุกคน</h2>
            <button className="flex items-center gap-1 rounded-full border border-ink/10 px-3 py-1.5 font-mono text-xs text-ink-muted">
              ดูรายละเอียด
              <IconChevronRight />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {data.members.map((member) => (
              <div
                key={member.id}
                className={`rounded-xl bg-surface p-4 shadow-soft ${member.isYou ? 'border-2 border-brand-100' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    imageUrl={member.imageUrl}
                    fallback={member.name[0]}
                    isLeader={member.isLeader}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-base font-bold text-ink truncate">{member.name}</span>
                      <button className="flex items-center gap-1 rounded-full border border-brand-200 px-2.5 py-1 text-brand-500">
                        <IconHeart />
                        <span className="font-mono text-xs font-bold">สะกิด</span>
                      </button>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="font-mono text-lg font-bold text-brand-500">{formatCurrency(member.saved)}</span>
                      <span className="font-mono text-xs text-ink-muted">/ {formatCurrency(member.target)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink-muted">{member.pct}%</span>
                      <div className="flex-1">
                        <ProgressBar value={member.pct} size="md" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Saving Plan Card */}
        <section className="rounded-xl bg-surface p-4 shadow-soft mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">แผนเก็บเงิน</p>
              <p className="font-mono text-xl font-bold text-ink mt-1">{data.savingPlan.status}</p>
            </div>
            <button className="grid h-12 w-12 place-items-center rounded-full bg-brand-500 text-white shadow-haloOrange">
              <IconEdit />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-500">
                <IconReceipt />
              </span>
              <div>
                <p className="font-mono text-[10px] text-ink-muted">เงิน</p>
                <p className="font-mono text-[10px] text-ink-muted">เป้าหมายวันนี้</p>
                <p className="font-mono text-sm font-bold text-ink">{formatCurrency(data.savingPlan.todayGoal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-500">
                <IconCalendar />
              </span>
              <div>
                <p className="font-mono text-[10px] text-ink-muted">ระยะเวลา</p>
                <p className="font-mono text-[10px] text-ink-muted">เหลืออีก</p>
                <p className="font-mono text-sm font-bold text-ink">{data.savingPlan.daysRemaining} วันที่แล้ว</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-500">
                <IconClock />
              </span>
              <div>
                <p className="font-mono text-[10px] text-ink-muted">ความคืบหน้า</p>
                <p className="font-mono text-[10px] text-ink-muted">จากเป้าหมาย</p>
                <p className="font-mono text-sm font-bold text-ink">{data.savingPlan.progressPct}%</p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Balance Check */}
        <section className="rounded-xl bg-surface p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-500">
                <IconReceipt />
              </span>
              <div>
                <p className="font-mono text-xs text-ink-muted">ยอดที่เช็คแล้ว</p>
                <p className="font-mono text-base font-bold text-ink">
                  {formatCurrency(data.recentCheck.amount)}
                  <span className="ml-2 font-normal text-ink-muted">· {data.recentCheck.matchStatus} · {data.recentCheck.daysAgo} วันก่อน</span>
                </p>
              </div>
            </div>
            <IconChevronRight />
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-surface border-t border-ink/10 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 px-4">
        <div className="flex items-center justify-around">
          <button className={`flex flex-col items-center gap-0.5 px-6 py-1 ${activeTab === 'dashboard' ? 'text-brand-500' : 'text-ink-muted'}`}>
            <IconGrid />
            <span className="font-mono text-[10px] font-bold">หน้าหลัก</span>
          </button>
          <button className={`flex flex-col items-center gap-0.5 px-6 py-1 ${activeTab === 'add' ? 'text-brand-500' : 'text-ink-muted'}`}>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-500 text-white -mt-4 shadow-haloOrange">
              <IconPlus />
            </span>
            <span className="font-mono text-[10px] font-bold text-ink-muted">หยอดเงิน</span>
          </button>
          <button className={`flex flex-col items-center gap-0.5 px-6 py-1 ${activeTab === 'profile' ? 'text-brand-500' : 'text-ink-muted'}`}>
            <IconUser />
            <span className="font-mono text-[10px] font-bold">โปรไฟล์</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
