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
        text-xs bg-surface border border-border px-3 py-1.5 rounded-full
        text-ink-muted
        hover:text-terracotta hover:border-terracotta
        disabled:opacity-40 disabled:cursor-not-allowed
        transition-colors duration-150
      "
    >
      🔀 Compare with…
    </button>
  );
}
