import { useState } from 'react';

const categories = [
  { id: 'flight', name: 'ค่าเครื่อง' },
  { id: 'hotel', name: 'ค่าโรงแรม' },
  { id: 'pocket', name: 'Pocket Money' },
  { id: 'activity', name: 'กิจกรรม' },
];

const quickAmounts = [100, 1400, 2700];

function PlaneIconLarge() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <path d="M30 8L20 18M20 18L22 28L17 25L13 30L11 22L3 20L8 15L20 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 18L13 11L5 13.5L8 6.5L13 8.5L20 18" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="#2A1A0E" strokeWidth="1.6"/>
      <rect x="13" y="2" width="7" height="7" rx="1.5" stroke="#2A1A0E" strokeWidth="1.6"/>
      <rect x="2" y="13" width="7" height="7" rx="1.5" stroke="#2A1A0E" strokeWidth="1.6"/>
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="#2A1A0E" strokeWidth="1.6"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 4V18M4 11H18" stroke="#F26B1A" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="7" r="4" stroke="#2A1A0E" strokeWidth="1.6"/>
      <path d="M2 19C2 15.7 6 13 11 13C16 13 20 15.7 20 19" stroke="#2A1A0E" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7.5" stroke="#F26B1A" strokeWidth="1.5"/>
      <path d="M9 5V13M6.5 6.5C6.5 5.7 7.7 5 9 5C10.3 5 11.5 5.7 11.5 6.5C11.5 8.5 6.5 8 6.5 10.5C6.5 11.6 7.7 12.5 9 12.5C10.3 12.5 11.5 11.6 11.5 10.5" stroke="#F26B1A" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

export function AddMoneyReferenceScreen() {
  const [activeCategory, setActiveCategory] = useState('flight');
  const [amount, setAmount] = useState('15');

  return (
    <div className="relative flex flex-col bg-bg min-h-screen w-full max-w-[390px] mx-auto overflow-hidden font-sans">
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1">
        <span className="font-mono font-semibold text-[15px] text-ink">23:17</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {['M', 'M'].map((l, i) => (
              <div key={i} className="w-5 h-5 rounded-sm bg-ink/10 flex items-center justify-center">
                <span className="font-mono text-[10px] font-bold text-ink">{l}</span>
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
      <div className="flex justify-end px-4 mb-2">
        <div className="bg-surface shadow-soft rounded-full px-3 py-1">
          <span className="font-mono text-[12px] text-ink-muted">v0.9.7</span>
        </div>
      </div>

      {/* Page header */}
      <div className="px-5 mb-1">
        <div className="font-sans text-[13px] font-semibold text-brand-500 mb-1">หยอดเงิน</div>
        <h1 className="font-mono font-bold text-[24px] text-ink leading-snug">หยอดเงินเข้าเป้าหมายย่อย</h1>
        <p className="font-sans text-[12px] text-ink-muted mt-1">บันทึกด้วยตัวเอง  แนบสลิปได้</p>
      </div>

      {/* Category tab strip */}
      <div className="px-5 mt-3 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 rounded-full px-4 py-2 font-sans font-semibold text-[13px] transition-all ${
                activeCategory === cat.id
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'bg-surface text-ink-muted shadow-soft'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Selected bucket card */}
      <div className="mx-4 mb-4 bg-surface rounded-2xl shadow-soft px-4 py-4">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-[68px] h-[68px] rounded-full bg-brand-500 flex items-center justify-center shrink-0 shadow-md">
            <PlaneIconLarge />
          </div>
          <div>
            <div className="font-sans font-semibold text-[17px] text-ink mb-0.5">ค่าเครื่อง</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-bold text-[20px] text-brand-500">฿1,629</span>
              <span className="font-sans text-[14px] text-ink-muted">/ ฿20,000</span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2.5 rounded-full bg-well overflow-hidden">
            <div className="h-full rounded-full bg-brand-500" style={{ width: '8%' }} />
          </div>
          <span className="font-mono font-semibold text-[13px] text-brand-500 shrink-0">8%</span>
        </div>
      </div>

      {/* Quick amounts section */}
      <div className="px-5 mb-2">
        <div className="font-sans text-[13px] text-ink-muted mb-2.5">จำนวนเงินที่ตั้งไว้แล้ว</div>
        <div className="flex gap-2">
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              onClick={() => setAmount(String(amt))}
              className="flex-1 bg-brand-50 border border-brand-200 rounded-full py-2.5 font-mono font-semibold text-[13px] text-ink transition-all hover:bg-brand-100"
            >
              +฿{amt.toLocaleString()}
            </button>
          ))}
        </div>

        {/* Edit link */}
        <div className="flex justify-end mt-2">
          <button className="flex items-center gap-1 text-ink-muted">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M10 2L11.5 3.5L5 10H3.5V8.5L10 2Z" stroke="#7A6A5E" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            <span className="font-sans text-[12px]">แก้ไข</span>
          </button>
        </div>
      </div>

      {/* Custom amount input */}
      <div className="px-5 mb-4">
        <div className="font-sans text-[13px] text-ink-muted mb-2">จำนวนเงินที่ระบุเอง</div>
        <div className="flex items-center gap-3 border-2 border-brand-400 rounded-full px-4 py-3 bg-surface">
          <CoinIcon />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 font-mono text-[18px] text-ink bg-transparent outline-none"
            placeholder="0"
          />
        </div>
      </div>

      {/* Progress preview card */}
      <div className="mx-4 mb-4 bg-surface rounded-2xl shadow-soft px-4 py-4">
        <div className="font-sans text-[13px] text-ink mb-3">
          ความคืบหน้าของ <span className="font-semibold text-ink">ค่าเครื่อง</span>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-2.5 rounded-full bg-well overflow-hidden">
            <div className="h-full rounded-full bg-brand-500" style={{ width: '8%' }} />
          </div>
          <span className="font-mono font-semibold text-[13px] text-brand-500">8%</span>
        </div>
        {/* Two-column stats */}
        <div className="flex gap-4">
          <div className="border-r border-brand-100 pr-4">
            <div className="font-sans text-[11px] text-ink-muted mb-0.5">บันทึกแล้ว</div>
            <div className="font-mono font-bold text-[16px] text-ink">฿1,629</div>
          </div>
          <div className="flex-1">
            <div className="font-sans text-[11px] text-ink-muted mb-0.5">
              เพิ่ม ฿{amount || '0'} <span className="text-brand-500 font-semibold">ซึ่งจะทำให้คุณคืบหน้ากว่า</span>
            </div>
            <div className="font-mono font-bold text-[16px] text-brand-500">8%</div>
          </div>
        </div>
      </div>

      {/* Spacer to push CTA down */}
      <div className="flex-1" />

      {/* Confirm CTA */}
      <div className="px-4 pb-2">
        <button className="w-full bg-brand-500 text-white font-sans font-bold text-[17px] rounded-full py-4 shadow-[0_8px_24px_-8px_rgba(242,107,26,0.5)] glow-orange">
          ยืนยันยอดนี้
        </button>
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-around px-6 pt-2 pb-4 bg-bg border-t border-brand-100/50">
        <button className="flex flex-col items-center gap-1">
          <GridIcon />
          <span className="font-sans text-[10px] text-ink-muted">หน้าหลัก</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <div className="w-11 h-11 rounded-full border-2 border-brand-400 flex items-center justify-center bg-surface shadow-soft">
            <PlusIcon />
          </div>
          <span className="font-sans text-[10px] font-semibold text-brand-500">หยอดเงิน</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <ProfileIcon />
          <span className="font-sans text-[10px] text-ink-muted">โปรไฟล์</span>
        </button>
      </div>

      {/* Home indicator bar */}
      <div className="flex justify-center pb-1.5">
        <div className="w-28 h-1 rounded-full bg-ink/20" />
      </div>
    </div>
  );
}
