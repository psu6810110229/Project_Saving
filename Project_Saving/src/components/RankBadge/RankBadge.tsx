interface Props {
  rank: number;
}

export function RankBadge({ rank }: Props) {
  const isFirst = rank === 1;

  return (
    <div className="flex items-center gap-1 shrink-0">
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold leading-none
          ${isFirst ? 'bg-terracotta text-white' : 'bg-ink/10 text-ink'}
        `}
        aria-label={`Rank ${rank}`}
      >
        #{rank}
      </div>
      {isFirst && (
        <span aria-hidden="true" className="text-base leading-none"></span>
      )}
    </div>
  );
}
