interface Props {
  streak: number;
  hasLoggedToday: boolean;
}

export function StreakFlame({ streak, hasLoggedToday }: Props) {
  if (streak === 0) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-ink-dim text-base">🔥</span>
        <span className="text-xs text-ink-dim">—</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1">
        <span className="text-base">🔥</span>
        <span className="text-sm font-bold text-terracotta">{streak}</span>
      </div>
      {!hasLoggedToday && (
        <span className="text-xs text-ink-dim">log today!</span>
      )}
    </div>
  );
}
