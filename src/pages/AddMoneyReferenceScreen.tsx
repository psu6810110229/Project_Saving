/**
 * AddMoneyReferenceScreen
 * Recreates the deposit form from add-reference.png
 * Form to add money to a specific savings bucket with quick amounts
 */

import { useState } from 'react';

// Dummy data matching the screenshot
const DUMMY_DATA = {
  bucket: {
    name: 'ค่าเครื่อง',
    icon: 'plane',
    saved: 1629,
    target: 20000,
    pct: 8,
  },
  categories: ['ค่าเครื่อง', 'ค่าโรงแรม', 'Pocket Money', 'กิจกรรม'],
  quickAmounts: [100, 1400, 2700],
};

function IconPlane({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}

function IconEdit({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="M15 5l4 4" />
    </svg>
  );
}

function IconPiggyBank({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z" />
      <path d="M2 9v1c0 1.1.9 2 2 2h1" />
      <path d="M16 11h.01" />
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

function IconPlus({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export function AddMoneyReferenceScreen() {
  const [selectedCategory, setSelectedCategory] = useState(DUMMY_DATA.categories[0]);
  const [selectedQuickAmount, setSelectedQuickAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('15');
  const [navTab] = useState<'dashboard' | 'add' | 'profile'>('add');

  const data = DUMMY_DATA;
  const currentAmount = Number(customAmount) || selectedQuickAmount || 0;
  const newTotal = data.bucket.saved + currentAmount;
  const newPct = Math.round((newTotal / data.bucket.target) * 100);

  return (
    <div className="min-h-screen bg-bg w-full max-w-[390px] mx-auto flex flex-col">
      {/* Version badge */}
      <div className="absolute top-4 right-4">
        <span className="font-mono text-xs text-ink-muted border border-ink/10 rounded-full px-2 py-0.5">v0.9.9</span>
      </div>

      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto px-4 pt-12 pb-24">
        {/* Header */}
        <div className="mb-4">
          <p className="font-mono text-sm font-bold uppercase tracking-wider text-brand-500">หยอดเงิน</p>
          <h1 className="font-mono text-2xl font-bold text-ink mt-1">หยอดเงินเข้าเป้าหมายย่อย</h1>
          <p className="font-mono text-sm text-ink-muted mt-1">บันทึกด้วยตัวเอง แนบสลิปได้</p>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
          {data.categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`shrink-0 rounded-full px-4 py-2 font-mono text-sm font-bold transition-colors ${
                selectedCategory === category
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface text-ink-muted border border-ink/10'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Bucket Card */}
        <div className="rounded-xl border border-brand-100 bg-surface p-4 shadow-soft mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center text-white shadow-haloOrange">
              <IconPlane size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-mono text-lg font-bold text-ink">{data.bucket.name}</h2>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono text-xl font-bold text-brand-500">{formatCurrency(data.bucket.saved)}</span>
                <span className="font-mono text-sm text-ink-muted">/ {formatCurrency(data.bucket.target)}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1">
              <ProgressBar value={data.bucket.pct} size="md" />
            </div>
            <span className="font-mono text-sm font-bold text-brand-500">{data.bucket.pct}%</span>
          </div>
        </div>

        {/* Quick Amounts */}
        <div className="mb-4">
          <p className="font-mono text-sm text-ink-muted mb-2">จำนวนเงินที่ตั้งไว้แล้ว</p>
          <div className="flex gap-2">
            {data.quickAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  setSelectedQuickAmount(amount);
                  setCustomAmount('');
                }}
                className={`flex-1 rounded-full px-4 py-2.5 font-mono text-sm font-bold transition-colors border ${
                  selectedQuickAmount === amount
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-surface text-ink border-ink/10 hover:border-brand-200'
                }`}
              >
                +{formatCurrency(amount)}
              </button>
            ))}
          </div>
          <button className="mt-2 self-end flex items-center gap-1 font-mono text-xs font-bold text-ink-muted ml-auto">
            <IconEdit size={14} />
            แก้ไข
          </button>
        </div>

        {/* Custom Amount Input */}
        <div className="mb-4">
          <p className="font-mono text-sm text-ink-muted mb-2">จำนวนเงินที่ระบุเอง</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500">
              <IconPiggyBank size={20} />
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value.replace(/[^0-9]/g, ''));
                setSelectedQuickAmount(null);
              }}
              className="w-full rounded-full border-2 border-brand-500 bg-surface py-3 pl-12 pr-4 font-mono text-lg font-bold text-ink outline-none focus:ring-2 focus:ring-brand-200"
              placeholder="0"
            />
          </div>
        </div>

        {/* Projected Progress Card */}
        <div className="rounded-xl border border-brand-100 bg-surface p-4 shadow-soft mb-6">
          <p className="font-mono text-sm text-ink-muted mb-2">ความคืบหน้าของ {data.bucket.name}</p>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1">
              <ProgressBar value={newPct} size="md" />
            </div>
            <span className="font-mono text-sm font-bold text-brand-500">{newPct}%</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-well">
            <div className="pr-4">
              <p className="font-mono text-xs text-ink-muted">บันทึกแล้ว</p>
              <p className="font-mono text-lg font-bold text-ink">{formatCurrency(data.bucket.saved)}</p>
            </div>
            <div className="pl-4">
              <p className="font-mono text-xs text-brand-500">
                เพิ่ม {formatCurrency(currentAmount)} ซึ่งจะทำให้คุณคืบหน้ากว่า
              </p>
              <p className="font-mono text-lg font-bold text-brand-500">{newPct}%</p>
            </div>
          </div>
        </div>

        {/* Confirm Button */}
        <button className="w-full rounded-full bg-brand-500 py-4 font-mono text-base font-bold text-white shadow-haloOrange active:scale-[0.98] transition-transform">
          ยืนยันยอดนี้
        </button>
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
            <span className="font-mono text-[10px] font-bold text-brand-500">หยอดเงิน</span>
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
