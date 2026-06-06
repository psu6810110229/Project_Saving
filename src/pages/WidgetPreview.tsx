import { SavingsWidgetPreviewCard } from '../components/SavingsWidget/SavingsWidget';

/**
 * Dev-only preview route at `/widget`. Renders both Android widget sizes on a
 * dark backdrop so the save-today-first hierarchy can be reviewed before a
 * native rebuild.
 */
export function WidgetPreview() {
  return (
    <div className="min-h-[100dvh] bg-[#0d0d0f] px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-white/55">
            GO-OUT Widget
          </p>
          <h1 className="mt-2 font-mono text-3xl font-bold text-white">พรีวิววิดเจ็ตแบบเก็บวันนี้ก่อน</h1>
        </div>

        <div className="flex flex-wrap items-start justify-center gap-8">
          <SavingsWidgetPreviewCard
            title="4x2 · สถานะต้องเก็บ"
            size="4x2"
            todayDue={160}
            todayState="due"
            todayPeriod="day"
            focusBucketName="Flights"
            focusBucketCount={1}
            saved={1600}
            goal={70000}
            progressPct={3}
            streak={7}
            streakUnit="day"
            roomName="Japan 2027"
          />

          <SavingsWidgetPreviewCard
            title="2x2 · สถานะต้องเก็บ"
            size="2x2"
            todayDue={160}
            todayState="due"
            todayPeriod="day"
            focusBucketName="Flights"
            focusBucketCount={1}
            saved={1600}
            goal={70000}
            progressPct={3}
            streak={7}
            streakUnit="day"
            roomName="Japan 2027"
          />

          <SavingsWidgetPreviewCard
            title="4x2 · สถานะครบแล้ว"
            size="4x2"
            todayDue={0}
            todayState="done"
            todayPeriod="day"
            focusBucketName="Flights"
            focusBucketCount={1}
            saved={41800}
            goal={70000}
            progressPct={60}
            streak={11}
            streakUnit="day"
            roomName="Japan 2027"
          />

          <SavingsWidgetPreviewCard
            title="2x2 · สถานะไม่มีแผน"
            size="2x2"
            todayDue={0}
            todayState="no_plan"
            todayPeriod="flex"
            focusBucketName={null}
            focusBucketCount={0}
            saved={12600}
            goal={40000}
            progressPct={32}
            streak={0}
            streakUnit="day"
            roomName="New Camera"
          />

          <SavingsWidgetPreviewCard
            title="2x2 · ทีม (พิล + อวตาร)"
            size="team"
            roomName="Japan 2027"
            saved={18000}
            goal={300000}
            progressPct={26}
            roomSaved={47000}
            roomGoal={300000}
            roomProgressPct={16}
            members={[
              { name: 'คุณ', saved: 18000, color: '#F26B1A', isYou: true, avatarUrl: 'https://i.pravatar.cc/100?img=12', streak: 7, loggedToday: true },
              { name: 'Bee', saved: 16800, color: '#2EA079', isYou: false, avatarUrl: 'https://i.pravatar.cc/100?img=5', streak: 12, loggedToday: false },
              { name: 'Ann', saved: 9000, color: '#6E7CCF', isYou: false, avatarUrl: null, streak: 3, loggedToday: true },
              { name: 'Tom', saved: 5000, color: '#5C6B7A', isYou: false, avatarUrl: 'https://i.pravatar.cc/100?img=33', streak: 0, loggedToday: false },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
