interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden rounded-lg bg-well/70 ${className}`}
    >
      {/* Translucent shimmer highlight that sweeps left-to-right.
          The gradient fades from transparent → warm white → transparent
          so it blends naturally with the warm palette. The global
          prefers-reduced-motion guard in global.css kills the animation
          automatically, leaving a calm static block. */}
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    </div>
  );
}
