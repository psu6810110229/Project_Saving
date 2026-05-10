export function GoalPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-sm mx-auto px-4 pt-6 flex flex-col gap-5">
        <h1 className="text-xl text-ink font-semibold">Goal Rooms</h1>

        <div className="bg-surface border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 text-center">
          <span className="text-4xl">🎯</span>
          <p className="text-ink font-semibold">Rooms coming soon</p>
          <p className="text-sm text-ink-muted">
            Join or create savings rooms to challenge a group — launching in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}
