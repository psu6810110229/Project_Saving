const PALETTE = [
  'bg-terracotta',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
] as const;

/** Deterministic color from userId — stable across renders. */
export function colorForUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0; // keep unsigned 32-bit
  }
  return PALETTE[hash % PALETTE.length];
}

interface Props {
  userId: string;
  displayName: string;
  /** Size in pixels. Default 40. */
  size?: number;
}

export function Avatar({ userId, displayName, size = 40 }: Props) {
  const bg = colorForUserId(userId);
  const initial = (displayName.trim()[0] ?? '?').toUpperCase();

  return (
    <div
      className={`${bg} rounded-full flex items-center justify-center shrink-0`}
      style={{ width: size, height: size }}
      aria-label={displayName}
    >
      <span className="text-white font-bold leading-none" style={{ fontSize: size * 0.4 }}>
        {initial}
      </span>
    </div>
  );
}
