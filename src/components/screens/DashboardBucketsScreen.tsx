import { useState } from 'react';

// ─── Bucket data ────────────────────────────────────────────────────────────
const buckets = [
  { id: 1, name: 'ค่าเครื่อง', saved: 1629, goal: 20000, pct: 8, Icon: PlaneIcon },
  { id: 2, name: 'ค่าโรงแรม', saved: 100, goal: 8000, pct: 1, Icon: HotelIcon },
  { id: 3, name: 'Pocket Money', saved: 0, goal: 12000, pct: 0, Icon: ForkIcon },
  { id: 4, name: 'กิจกรรม', saved: 0, goal: 5000, pct: 0, Icon: TicketIcon },
  { id: 5, name: 'Accessories', saved: 0, goal: 3000, pct: 0, Icon: BagIcon },
  { id: 6, name: 'ของฝาก', saved: 0, goal: 2000, pct: 0, Icon: BagSmallIcon },
];

// Bar chart data — อ พ พฤ ศ ส อา จ
const chartData = [
  { day: 'อ', you: 1000, partner: 1000 },
  { day: 'พ', you: 100, partner: 500 },
  { day: 'พฤ', you: 14, partner: 100 },
  { day: 'ศ', you: 100, partner: 15 },
  { day: 'ส', you: 0, partner: 0 },
  { day: 'อา', you: 0, partner: 200 },
  { day: 'จ', you: 0, partner: 200 },
];

const MAX_BAR = 1000;

// ─── Icon components ─────────────────────────────────────────────────────────
function PlaneIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M24 6L16 14M16 14L18 22L14 20L10 24L8 18L2 16L6 12L14 14M16 14L10 8L4 10L6 4L10 6L14 14" stroke="#F26B1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function HotelIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="3" y="8" width="22" height="16" rx="2" stroke="#F26B1A" strokeWidth="1.8"/>
      <rect x="3" y="8" width="22" height="6" rx="1" stroke="#F26B1A" strokeWidth="1.8"/>
      <path d="M7 19H11M17 19H21" stroke="#F26B1A" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M8 4H20" stroke="#F26B1A" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function ForkIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M9 4V11C9 12.7 10.3 14 12 14V24" stroke="#F26B1A" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M7 4V8M11 4V8" stroke="#F26B1A" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M19 4C19 4 22 6.5 22 10C22 12.2 20.8 14 19 14V24" stroke="#F26B1A" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function TicketIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M3 10C3 9.4 3.4 9 4 9H24C24.6 9 25 9.4 25 10V12C23.9 12 23 12.9 23 14C23 15.1 23.9 16 25 16V18C25 18.6 24.6 19 24 19H4C3.4 19 3 18.6 3 18V16C4.1 16 5 15.1 5 14C5 12.9 4.1 12 3 12V10Z" stroke="#F26B1A" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M10 9V19M18 9V19" stroke="#F26B1A" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 2"/>
    </svg>
  );
}
function BagIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="5" y="10" width="18" height="14" rx="3" stroke="#F26B1A" strokeWidth="1.8"/>
      <path d="M10 10V8C10 6.3 11.8 5 14 5C16.2 5 18 6.3 18 8V10" stroke="#F26B1A" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M5 16H23" stroke="#F26B1A" strokeWidth="1.8"/>
    </svg>
  );
}
function BagSmallIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="6" y="10" width="16" height="14" rx="2.5" stroke="#F26B1A" strokeWidth="1.8"/>
      <path d="M11 10V8C11 6.9 12.3 6 14 6C15.7 6 17 6.9 17 8V10" stroke="#F26B1A" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="14" cy="16" r="1.5" fill="#F26B1A"/>
    </svg>
  );
}

// ─── Trend arrow ─────────────────────────────────────────────────────────────
function TrendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 11L6 7L9 10L14 4" stroke="#F26B1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 4H14V7" stroke="#F26B1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DashboardBucketsScreen() {
  const [activeTab, setActiveTab] = useState<'you' | 'partner'>('you');

  return (
    <div className="relative flex flex-col bg-bg min-h-screen w-full max-w-[390px] mx-auto overflow-hidden font-sans">
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1">
        <span className="font-mono font-semibold text-[15px] text-ink">23:16</span>
        <div className="flex items-center gap-2">
          {/* Notification icons row (simplified) */}
          <div className="flex items-center gap-1.5">
            {['M', 'M'].map((letter, i) => (
              <div key={i} className="w-5 h-5 rounded-sm bg-ink/10 flex items-center justify-center">
                <span className="font-mono text-[10px] font-bold text-ink">{letter}</span>
              </div>
            ))}
          </div>
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
            <rect x="0" y="4" width="3" height="8" rx="1" fill="#2A1A0E"/>
            <rect x="4.5" y="2.5" width="3" height="9.5" rx="1" fill="#2A1A0E"/>
            <rect x="9" y="0.5" width="3" height="11.5" rx="1" fill="#2A1A0E"/>
            <rect x="13.5" y="0.5" width="3" height="11.5" rx="1" fill="#2A1A0E" opacity="0.3"/>
          </svg>
          <div className="flex items-center border-2 border-ink rounded-sm px-1 gap-0.5 h-5">
            <div className="w-4 h-2.5 bg-ink rounded-[1px]" />
          </div>
          <span className="font-mono text-[13px] text-ink">70</span>
        </div>
      </div>

      {/* Version badge */}
      <div className="flex justify-end px-4 mb-1">
        <div className="bg-surface shadow-soft rounded-full px-3 py-1">
          <span className="font-mono text-[12px] text-ink-muted">v0.9.7</span>
        </div>
      </div>

      {/* Segmented tabs */}
      <div className="flex justify-center px-4 mb-2">
        <div className="flex bg-surface shadow-soft rounded-full p-1 gap-1 w-full max-w-[240px]">
          <button
            onClick={() => setActiveTab('you')}
            className={`flex-1 py-2 rounded-full font-sans font-semibold text-[14px] transition-all ${
              activeTab === 'you'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-ink-muted'
            }`}
          >
            คุณ
          </button>
          <button
            onClick={() => setActiveTab('partner')}
            className={`flex-1 py-2 rounded-full font-sans font-semibold text-[14px] transition-all ${
              activeTab === 'partner'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-ink-muted'
            }`}
          >
            พี่ทีร์โม
          </button>
        </div>
      </div>

      {/* Page title */}
      <div className="px-5 mb-1">
        <h1 className="font-mono font-bold text-[28px] text-ink leading-tight">เป้าหมายย่อย</h1>
        <p className="font-sans text-[13px] text-ink-muted mt-0.5">ตอนนี้คุณมี 6 เป้าหมายย่อย</p>
      </div>

      {/* Add bucket button */}
      <div className="px-5 mt-3 mb-4">
        <button className="flex items-center gap-2 bg-brand-500 text-white font-sans font-semibold text-[15px] rounded-full px-5 py-3 shadow-md">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2V14M2 8H14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          เพิ่มเป้าหมายย่อย
        </button>
      </div>

      {/* Bucket grid */}
      <div className="px-4">
        <div className="grid grid-cols-2 gap-3 mb-5">
          {buckets.map((b) => (
            <div key={b.id} className="bg-surface rounded-2xl shadow-soft px-4 pt-3 pb-3.5 relative">
              {/* Percent badge */}
              <div className="absolute top-3 right-3">
                <span className="font-mono text-[12px] font-semibold text-brand-500">{b.pct}%</span>
              </div>
              {/* Icon bubble */}
              <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mb-2.5">
                <b.Icon />
              </div>
              {/* Name */}
              <div className="font-sans font-semibold text-[13px] text-ink mb-0.5">{b.name}</div>
              {/* Amounts */}
              <div className="font-sans text-[11px] text-ink-muted mb-2">
                ฿{b.saved.toLocaleString()} / ฿{b.goal.toLocaleString()}
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-well overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.max(b.pct, b.pct > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily deposit chart card */}
      <div className="mx-4 mb-6 bg-surface rounded-2xl shadow-soft px-4 pt-4 pb-3">
        {/* Header row */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center">
              <TrendIcon />
            </div>
            <span className="font-sans font-semibold text-[14px] text-ink">ยอดฝากรายวัน</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500 inline-block" />
              <span className="font-sans text-[11px] text-ink-muted">คุณ</span>
            </div>
            <div className="font-mono font-bold text-[13px] text-ink">฿1,729</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4A6FA5] inline-block" />
              <span className="font-sans text-[11px] text-ink-muted">พี่ทีร์โม</span>
            </div>
            <div className="font-mono font-bold text-[13px] text-ink">฿6,363</div>
          </div>
        </div>

        {/* Total */}
        <div className="mb-3">
          <span className="font-mono font-bold text-[28px] text-brand-500">฿8,092</span>
          <span className="font-sans text-[12px] text-ink-muted ml-2">7 วันที่ผ่านมา</span>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-1.5 h-32 relative">
          {/* Y-axis labels */}
          <div className="flex flex-col justify-between h-full absolute -left-1 top-0 pb-4">
            <span className="font-mono text-[9px] text-ink-dim">1000</span>
            <span className="font-mono text-[9px] text-ink-dim">500</span>
            <span className="font-mono text-[9px] text-ink-dim">0</span>
          </div>

          {/* Bars */}
          <div className="flex items-end gap-1.5 w-full h-full pl-5 pb-5">
            {chartData.map((d) => {
              const youH = Math.round((d.you / MAX_BAR) * 88);
              const partnerH = Math.round((d.partner / MAX_BAR) * 88);
              return (
                <div key={d.day} className="flex flex-col items-center flex-1 gap-0.5">
                  {/* Labels above bars */}
                  <div className="flex gap-0.5 items-end mb-0.5">
                    {d.you > 0 && (
                      <span className="font-mono text-[8px] text-brand-500 leading-none">{d.you}</span>
                    )}
                    {d.partner > 0 && (
                      <span className="font-mono text-[8px] text-[#4A6FA5] leading-none">{d.partner}</span>
                    )}
                    {d.you === 0 && d.partner === 0 && (
                      <>
                        <span className="font-mono text-[8px] text-brand-300 leading-none">0</span>
                        <span className="font-mono text-[8px] text-[#8098BB] leading-none">0</span>
                      </>
                    )}
                  </div>
                  {/* Bar pair */}
                  <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: '72px' }}>
                    <div
                      className="w-3 rounded-t bg-brand-500"
                      style={{ height: `${Math.max(youH, d.you > 0 ? 4 : 1)}px` }}
                    />
                    <div
                      className="w-3 rounded-t bg-[#4A6FA5]"
                      style={{ height: `${Math.max(partnerH, d.partner > 0 ? 4 : 1)}px` }}
                    />
                  </div>
                  {/* Day label */}
                  <span className="font-sans text-[9px] text-ink-muted">{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
