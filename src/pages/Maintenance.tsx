import { SectionLabel } from '../components/SectionLabel/SectionLabel';

export function Maintenance() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-bg p-6">
      <section className="w-full max-w-sm rounded-xl bg-surface p-8 text-center shadow-soft">
        <SectionLabel tone="brand" className="text-center">GO-OUT</SectionLabel>

        <div className="mt-5 text-4xl">🔧</div>

        <h1 className="mt-4 font-mono text-lg font-bold text-ink">
          กำลังปรับปรุงระบบ
        </h1>

        <p className="mt-4 font-mono text-sm leading-5 text-ink-dim">
          เรากำลังปรับปรุงเพื่อประสบการณ์ให้ดีขึ้น กรุณากลับมาใหม่ในภายหลัง
        </p>
      </section>
    </div>
  );
}
