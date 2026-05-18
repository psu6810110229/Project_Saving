import { useState } from 'react';
import { DashboardReferenceScreen } from '../components/screens/DashboardReferenceScreen';
import { DashboardBucketsScreen } from '../components/screens/DashboardBucketsScreen';
import { AddMoneyReferenceScreen } from '../components/screens/AddMoneyReferenceScreen';

const screens = [
  { id: 'dashboard', label: 'Dashboard', component: DashboardReferenceScreen },
  { id: 'buckets', label: 'Buckets', component: DashboardBucketsScreen },
  { id: 'add', label: 'Add Money', component: AddMoneyReferenceScreen },
];

export function ScreensPreview() {
  const [active, setActive] = useState('dashboard');
  const Screen = screens.find((s) => s.id === active)?.component ?? DashboardReferenceScreen;

  return (
    <div className="min-h-screen bg-[#E8DDD4] flex flex-col items-center py-8 px-4 font-sans">
      {/* Tab switcher */}
      <div className="flex gap-2 mb-8 bg-white/60 rounded-full p-1.5 shadow-soft backdrop-blur-sm">
        {screens.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`rounded-full px-5 py-2 font-mono font-semibold text-[13px] transition-all ${
              active === s.id
                ? 'bg-brand-500 text-white shadow-md'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Phone shell */}
      <div
        className="relative rounded-[44px] overflow-hidden shadow-[0_24px_64px_-12px_rgba(42,26,14,0.28),0_8px_24px_-8px_rgba(42,26,14,0.16)]"
        style={{
          width: 390,
          background: '#FBF6F0',
          border: '8px solid #1A1A1A',
          minHeight: 820,
        }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#1A1A1A] rounded-b-2xl z-20" />
        {/* Scrollable screen area */}
        <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: '85vh', paddingTop: '24px' }}>
          <Screen />
        </div>
      </div>

      {/* Screen label */}
      <div className="mt-5 font-mono text-[13px] text-ink-muted opacity-70">
        {screens.find((s) => s.id === active)?.label} Screen
      </div>
    </div>
  );
}
