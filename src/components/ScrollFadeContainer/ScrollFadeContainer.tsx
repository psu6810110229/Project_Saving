import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';

interface ScrollFadeContainerProps {
  children: ReactNode;
  /** Tailwind classes forwarded to the scrollable inner div. */
  className?: string;
  /** Tailwind classes forwarded to the outer positioning wrapper.
   *  Use this when the scroll container needs negative margins (e.g.
   *  `-mx-4`) so the fade overlays align with the visible edges. */
  wrapperClassName?: string;
  /** Fade gradient width in pixels. */
  fadeWidth?: number;
  /**
   * Colour stop for the opaque edge of the gradient.
   * Must match the parent background so the fade blends seamlessly.
   * @default '#FFFFFF' (surface card white)
   */
  fadeColor?: string;
}

export function ScrollFadeContainer({
  children,
  className = '',
  wrapperClassName = '',
  fadeWidth = 24,
  fadeColor = '#FFFFFF',
}: ScrollFadeContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    check();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, [check]);

  const transparent = fadeColor.startsWith('#')
    ? fadeColor + '00'
    : fadeColor.replace(/,\s*[\d.]+\)/, ', 0)');

  return (
    <div className={`relative ${wrapperClassName}`.trim()}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 transition-opacity duration-200"
        style={{
          width: fadeWidth,
          background: `linear-gradient(to right, ${fadeColor}, ${transparent})`,
          opacity: canScrollLeft ? 1 : 0,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 transition-opacity duration-200"
        style={{
          width: fadeWidth,
          background: `linear-gradient(to left, ${fadeColor}, ${transparent})`,
          opacity: canScrollRight ? 1 : 0,
        }}
      />
      <div ref={scrollRef} className={className}>
        {children}
      </div>
    </div>
  );
}
