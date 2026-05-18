export function DashboardReferenceScreen() {
  return (
    <div className="relative flex flex-col bg-bg min-h-screen w-full max-w-[390px] mx-auto overflow-hidden font-sans">
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1">
        <span className="font-mono font-semibold text-[15px] text-ink">23:12</span>
        <div className="flex items-center gap-1.5">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
            <rect x="0" y="4" width="3" height="8" rx="1" fill="#2A1A0E"/>
            <rect x="4.5" y="2.5" width="3" height="9.5" rx="1" fill="#2A1A0E"/>
            <rect x="9" y="0.5" width="3" height="11.5" rx="1" fill="#2A1A0E"/>
            <rect x="13.5" y="0.5" width="3" height="11.5" rx="1" fill="#2A1A0E" opacity="0.3"/>
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M8 2.5C5.6 2.5 3.5 3.6 2 5.3L0.5 3.8C2.4 1.8 5.1 0.5 8 0.5C10.9 0.5 13.6 1.8 15.5 3.8L14 5.3C12.5 3.6 10.4 2.5 8 2.5Z" fill="#2A1A0E"/>
            <path d="M8 5.5C6.4 5.5 5 6.2 4 7.2L2.5 5.7C3.9 4.3 5.9 3.5 8 3.5C10.1 3.5 12.1 4.3 13.5 5.7L12 7.2C11 6.2 9.6 5.5 8 5.5Z" fill="#2A1A0E"/>
            <circle cx="8" cy="10.5" r="1.5" fill="#2A1A0E"/>
          </svg>
          <div className="flex items-center border-2 border-ink rounded-sm px-1 gap-0.5 h-5">
            <div className="w-5 h-2.5 bg-ink rounded-[1px]" />
            <div className="w-1 h-1.5 bg-ink rounded-[1px] -mr-1" />
          </div>
          <span className="font-mono text-[13px] text-ink">71</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-2 pb-1">
        <div className="flex items-center gap-2">
          <h1 className="font-mono font-bold text-[26px] text-ink leading-tight">Japan 2027</h1>
          <button className="w-7 h-7 rounded-full bg-surface shadow-soft flex items-center justify-center">
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="#2A1A0E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 rounded-full bg-surface shadow-soft flex items-center justify-center">
            <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
              <circle cx="8" cy="5" r="3.5" stroke="#2A1A0E" strokeWidth="1.8"/>
              <path d="M1 17C1 13.7 4.1 11 8 11" stroke="#2A1A0E" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="15" cy="5" r="3.5" stroke="#2A1A0E" strokeWidth="1.8"/>
              <path d="M21 17C21 13.7 17.9 11 14 11" stroke="#2A1A0E" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="w-10 h-10 rounded-full bg-surface shadow-soft flex items-center justify-center">
            <svg width="18" height="4" viewBox="0 0 18 4" fill="none">
              <circle cx="2" cy="2" r="2" fill="#2A1A0E"/>
              <circle cx="9" cy="2" r="2" fill="#2A1A0E"/>
              <circle cx="16" cy="2" r="2" fill="#2A1A0E"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Room members pill */}
      <div className="px-5 mb-3">
        <div className="inline-flex items-center gap-1.5 bg-surface shadow-soft rounded-full px-3 py-1.5">
          <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
            <circle cx="5.5" cy="4" r="3" stroke="#7A6A5E" strokeWidth="1.5"/>
            <path d="M0.5 13C0.5 10.5 2.7 8.5 5.5 8.5" stroke="#7A6A5E" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="11" cy="4" r="3" stroke="#7A6A5E" strokeWidth="1.5"/>
            <path d="M16 13C16 10.5 13.8 8.5 11 8.5" stroke="#7A6A5E" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="font-sans text-[13px] text-ink-muted">2 คนในห้องนี้</span>
        </div>
      </div>

      {/* Total vault card — orange */}
      <div className="mx-4 rounded-2xl bg-brand-600 overflow-hidden shadow-soft">
        <div className="px-5 pt-4 pb-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 5L7 1L12 5V12H9V9H5V12H2V5Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                  <rect x="4" y="1" width="2" height="1" rx="0.5" fill="white"/>
                </svg>
              </div>
              <span className="font-sans text-[13px] text-white/90">ยอดเงินรวมของทุกคน</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-full px-2.5 py-0.5">
                <span className="font-mono text-[13px] font-semibold text-white">5%</span>
              </div>
              <button className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M7.5 1.5L10.5 4.5L4 11H1V8L7.5 1.5Z" stroke="white" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-mono font-bold text-[34px] text-white leading-none">฿8,092</span>
            <span className="font-sans text-[16px] text-white/70">/ ฿150,000</span>
          </div>

          {/* Progress bar */}
          <div className="mt-3 mb-0 h-2.5 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full rounded-full bg-white" style={{ width: '5.4%' }} />
          </div>
        </div>

        {/* Bottom stats row — white section */}
        <div className="mt-3 bg-white rounded-b-2xl">
          <div className="flex">
            <div className="flex-1 flex items-center gap-3 px-4 py-3.5 border-r border-brand-100">
              <div className="w-9 h-9 rounded-full bg-surfaceAlt flex items-center justify-center">
                <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
                  <rect x="1" y="4" width="16" height="11" rx="2.5" stroke="#B5A496" strokeWidth="1.5"/>
                  <path d="M5 4V3C5 1.9 5.9 1 7 1H11C12.1 1 13 1.9 13 3V4" stroke="#B5A496" strokeWidth="1.5"/>
                  <circle cx="9" cy="9.5" r="2" fill="#B5A496"/>
                </svg>
              </div>
              <div>
                <div className="font-sans text-[11px] text-ink-muted">เก็บไปแล้ว</div>
                <div className="font-mono font-bold text-[15px] text-brand-600">฿8,092</div>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-surfaceAlt flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="7.5" stroke="#B5A496" strokeWidth="1.5"/>
                  <circle cx="9" cy="9" r="4.5" stroke="#B5A496" strokeWidth="1.5"/>
                  <path d="M12.5 5.5L9 9" stroke="#B5A496" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="9" cy="9" r="1" fill="#B5A496"/>
                </svg>
              </div>
              <div>
                <div className="font-sans text-[11px] text-ink-muted">เป้าหมาย</div>
                <div className="font-mono font-bold text-[15px] text-ink">฿150,000</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress section */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono font-bold text-[17px] text-ink">ความคืบหน้าของทุกคน</h2>
          <button className="flex items-center gap-1 bg-surface shadow-soft rounded-full px-3 py-1.5">
            <span className="font-sans text-[12px] text-ink-muted">ดูรายละเอียด</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 3L7.5 6L4.5 9" stroke="#7A6A5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Player 1 — crown + avatar */}
        <div className="bg-surface rounded-2xl shadow-soft p-4 mb-2">
          <div className="flex items-center gap-3">
            {/* Avatar with crown */}
            <div className="relative shrink-0">
              <div className="absolute -top-2 -left-1 z-10">
                <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center shadow-sm">
                  <svg width="12" height="11" viewBox="0 0 12 11" fill="none">
                    <path d="M1 8L2.5 3L5.5 6L6 1L6.5 6L9.5 3L11 8H1Z" fill="white"/>
                  </svg>
                </div>
              </div>
              <div className="w-[60px] h-[60px] rounded-full overflow-hidden border-[2.5px] border-brand-500">
                <img
                  src="/avatar-teermo.jpg"
                  alt="พี่เทีร์โม"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="font-sans font-semibold text-[15px] text-ink mb-0.5">พี่เทีร์โม</div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span className="font-mono font-bold text-[16px] text-brand-600">฿6,363</span>
                <span className="font-sans text-[12px] text-ink-muted">/ ฿75,000</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-[11px] text-ink-muted">8%</span>
                <div className="flex-1 h-2 rounded-full bg-well overflow-hidden">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: '8%' }} />
                </div>
              </div>
            </div>

            {/* Nudge button */}
            <button className="shrink-0 flex items-center gap-1.5 border border-brand-200 rounded-full px-3.5 py-2 bg-white">
              <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
                <path d="M11.5 5.5C11.5 8.5 6.5 11.5 6.5 11.5C6.5 11.5 1.5 8.5 1.5 5.5C1.5 3 3.8 1 6.5 1C9.2 1 11.5 3 11.5 5.5Z" stroke="#F26B1A" strokeWidth="1.3"/>
                <circle cx="6.5" cy="5.5" r="1.5" fill="#F26B1A"/>
              </svg>
              <span className="font-sans text-[13px] text-brand-500">สะกิด</span>
            </button>
          </div>
        </div>

        {/* Player 2 */}
        <div className="bg-surface rounded-2xl shadow-soft p-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-[60px] h-[60px] rounded-full overflow-hidden border-[2.5px] border-brand-400">
                <img
                  src="/avatar-you.jpg"
                  alt="คุณ - FRANVMe"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-sans font-semibold text-[15px] text-ink mb-0.5">คุณ - FRANVMe</div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span className="font-mono font-bold text-[16px] text-brand-600">฿1,729</span>
                <span className="font-sans text-[12px] text-ink-muted">/ ฿75,000</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-[11px] text-ink-muted">2%</span>
                <div className="flex-1 h-2 rounded-full bg-well overflow-hidden">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: '2%' }} />
                </div>
              </div>
            </div>

            <button className="shrink-0 flex items-center gap-1.5 border border-brand-200 rounded-full px-3.5 py-2 bg-white">
              <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
                <path d="M11.5 5.5C11.5 8.5 6.5 11.5 6.5 11.5C6.5 11.5 1.5 8.5 1.5 5.5C1.5 3 3.8 1 6.5 1C9.2 1 11.5 3 11.5 5.5Z" stroke="#F26B1A" strokeWidth="1.3"/>
                <circle cx="6.5" cy="5.5" r="1.5" fill="#F26B1A"/>
              </svg>
              <span className="font-sans text-[13px] text-brand-500">สะกิด</span>
            </button>
          </div>
        </div>

        {/* Saving plan card */}
        <div className="bg-surface rounded-2xl shadow-soft px-4 pt-4 pb-3 mb-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-sans text-[12px] text-ink-muted mb-0.5">แผนเก็บเงิน</div>
              <div className="font-mono font-bold text-[20px] text-ink">ยังไม่เริ่ม</div>
            </div>
            <button className="w-11 h-11 rounded-full bg-brand-500 flex items-center justify-center shadow-md">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13 3L10 6M3 13L6 10M10 3L13 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="7.5" cy="7.5" r="3" stroke="white" strokeWidth="1.8"/>
              </svg>
            </button>
          </div>

          {/* 3-stat row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="flex flex-col gap-1">
              <div className="w-8 h-8 rounded-lg bg-surfaceAlt flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="4" width="14" height="10" rx="2" stroke="#7A8C5A" strokeWidth="1.4"/>
                  <path d="M4 4V3C4 2.4 4.4 2 5 2H11C11.6 2 12 2.4 12 3V4" stroke="#7A8C5A" strokeWidth="1.4"/>
                  <circle cx="8" cy="9" r="2" fill="#7A8C5A"/>
                </svg>
              </div>
              <div className="font-sans text-[10px] text-ink-muted leading-tight">เงิน<br/>เป้าหมายวันนี้</div>
              <div className="font-mono font-bold text-[13px] text-ink">฿0</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="w-8 h-8 rounded-lg bg-surfaceAlt flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="3" width="12" height="11" rx="2" stroke="#5C6B7A" strokeWidth="1.4"/>
                  <path d="M2 7H14" stroke="#5C6B7A" strokeWidth="1.4"/>
                  <path d="M5 1V5M11 1V5" stroke="#5C6B7A" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="font-sans text-[10px] text-ink-muted leading-tight">ระยะเวลา<br/>เหลืออีก</div>
              <div className="font-mono font-bold text-[13px] text-ink">3 วันที่แล้ว</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="w-8 h-8 rounded-lg bg-surfaceAlt flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="#5C6B7A" strokeWidth="1.4"/>
                  <path d="M8 1.5V8L12 10" stroke="#5C6B7A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="font-sans text-[10px] text-ink-muted leading-tight">ความคืบหน้า<br/>จากเป้าหมาย</div>
              <div className="font-mono font-bold text-[13px] text-ink">5%</div>
            </div>
          </div>

          {/* Last check row */}
          <div className="flex items-center justify-between border-t border-brand-100/60 pt-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-surfaceAlt flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="2" width="12" height="10" rx="2" stroke="#B5A496" strokeWidth="1.3"/>
                  <path d="M4 7L6 9L10 5" stroke="#B5A496" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div className="font-sans text-[11px] text-ink-muted">ยอดที่เช็คแล้ว</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono font-semibold text-[12px] text-ink">฿1,629</span>
                  <span className="text-ink-dim text-[11px]">•</span>
                  <span className="font-sans text-[11px] text-ink-muted">ตรงกัน</span>
                  <span className="text-ink-dim text-[11px]">•</span>
                  <span className="font-sans text-[11px] text-ink-muted">1 วันก่อน</span>
                </div>
              </div>
            </div>
            <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
              <path d="M1.5 1.5L6.5 6.5L1.5 11.5" stroke="#B5A496" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
