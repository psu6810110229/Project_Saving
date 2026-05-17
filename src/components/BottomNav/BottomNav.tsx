import { type ReactNode, useRef, useEffect, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';
import { BottomTabItem } from '../BottomTabItem/BottomTabItem';
import { IconGrid, IconPlus, IconUser } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';

export type BottomNavTab = 'dashboard' | 'add' | 'profile';

interface BottomNavProps {
  activeTab: BottomNavTab;
  onChange: (tab: BottomNavTab) => void;
}

const TAB_ICONS: { id: BottomNavTab; icon: ReactNode }[] = [
  { id: 'dashboard', icon: <IconGrid size={22} /> },
  { id: 'add', icon: <IconPlus size={24} /> },
  { id: 'profile', icon: <IconUser size={22} /> },
];

/** Apply Apple-style liquid glass blur to the floating pill (avoids re-renders). */
function applyBlurStyle(pill: HTMLElement, scrollY: number) {
  // Stronger blur + saturation = Apple "liquid glass" feel
  const blur = Math.min(10, 20 + scrollY * 0.05);
  const saturation = Math.min(200, 160 + scrollY * 0.08);
  const opacity = Math.min(0.62, 0.42 + scrollY * 0.0005);
  const filter = `blur(${blur}px) saturate(${saturation}%)`;
  pill.style.backdropFilter = filter;
  pill.style.setProperty('-webkit-backdrop-filter', filter);
  pill.style.backgroundColor = `rgba(255, 252, 248, ${opacity})`;
}

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const { copy } = useI18n();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const rafId = useRef(0);
  const reduceMotion = useReducedMotion();

  const handleScroll = useCallback((e: Event) => {
    const pill = pillRef.current;
    if (!pill) return;
    const target = e.currentTarget as HTMLElement;
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      applyBlurStyle(pill, target.scrollTop);
    });
  }, []);

  useEffect(() => {
    // Skip dynamic blur for reduced-motion users — keep static Tailwind classes
    if (reduceMotion) return;

    const pill = pillRef.current;
    if (!pill) return;

    // Find the scoped scroll container from PageTransition
    const attach = () => {
      const sc = document.querySelector<HTMLElement>('[data-page-scroll]');
      if (!sc) return;
      applyBlurStyle(pill, sc.scrollTop);
      sc.addEventListener('scroll', handleScroll, { passive: true });
    };

    attach();

    // Re-attach when the scroll container swaps (route change)
    const observer = new MutationObserver(() => attach());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      const sc = document.querySelector<HTMLElement>('[data-page-scroll]');
      if (sc) sc.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId.current);
      if (pill) {
        pill.style.backdropFilter = '';
        pill.style.setProperty('-webkit-backdrop-filter', '');
        pill.style.backgroundColor = '';
      }
    };
  }, [reduceMotion, handleScroll]);

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2 pointer-events-none"
    >
      <div
        ref={pillRef}
        className="pointer-events-auto relative mx-auto max-w-md rounded-full px-2 py-2 flex items-center bg-white/45 backdrop-blur-2xl backdrop-saturate-[1.8] ring-1 ring-white/60 shadow-[0_8px_32px_-4px_rgba(60,40,20,0.18),0_2px_8px_-2px_rgba(60,40,20,0.08),inset_0_1px_0_0_rgba(255,255,255,0.7)] overflow-hidden"
      >
        {/* Top specular highlight — gives the "wet glass" sheen */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/55 to-transparent"
        />
        {/* Tabs */}
        <div className="relative z-10 flex items-center w-full">
          {TAB_ICONS.map(tab => (
            <BottomTabItem
              key={tab.id}
              label={copy.nav[tab.id]}
              icon={tab.icon}
              active={activeTab === tab.id}
              onClick={() => onChange(tab.id)}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
