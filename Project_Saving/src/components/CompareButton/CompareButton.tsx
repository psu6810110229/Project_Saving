interface Props {
  onClick: () => void;
  disabled?: boolean;
}

export function CompareButton({ onClick, disabled }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        w-full flex items-center justify-center gap-2
        bg-white border-2 border-border/80 rounded-xl px-5 py-3.5
        text-sm font-bold text-ink shadow-sm
        hover:border-terracotta hover:text-terracotta hover:shadow-md
        active:scale-95
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-all duration-200 group
      "
    >
      <span className="text-lg group-hover:scale-110 transition-transform"></span>
      Compare with partner
    </button>
  );
}
