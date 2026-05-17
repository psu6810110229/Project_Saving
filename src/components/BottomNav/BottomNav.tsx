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

/** Apply dynamic blur + opacity directly to the DOM node (avoids re-renders). */
function applyBlurStyle(nav: HTMLElement, scrollY: number) {
  const blur = Math.min(20, 8 + scrollY * 0.04);
  const opacity = Math.min(0.92, 0.65 + scrollY * 0.001);
  nav.style.backdropFilter = `blur(${blur}px)`;
  nav.style.setProperty('-webkit-backdrop-filter', `blur(${blur}px)`);
  nav.style.backgroundColor = `rgba(251, 246, 240, ${opacity})`; // matches bg #FBF6F0
}

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const { copy } = useI18n();
  const navRef = useRef<HTMLElement>(null);
  const rafId = useRef(0);
  const reduceMotion = useReducedMotion();

  const handleScroll = useCallback((e: Event) => {
    const nav = navRef.current;
    if (!nav) return;
    const target = e.currentTarget as HTMLElement;
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      applyBlurStyle(nav, target.scrollTop);
    });
  }, []);

  useEffect(() => {
    // Skip dynamic blur for reduced-motion users — keep static Tailwind classes
    if (reduceMotion) return;

    const nav = navRef.current;
    if (!nav) return;

    // Find the scoped scroll container from PageTransition
    const attach = () => {
      const sc = document.querySelector<HTMLElement>('[data-page-scroll]');
      if (!sc) return;
      applyBlurStyle(nav, sc.scrollTop);
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
      // Reset inline styles so Tailwind classes apply again
      if (nav) {
        nav.style.backdropFilter = '';
        nav.style.setProperty('-webkit-backdrop-filter', '');
        nav.style.backgroundColor = '';
      }
    };
  }, [reduceMotion, handleScroll]);

  return (
    <nav
      ref={navRef}
      className="fixed inset-x-0 bottom-0 z-40 bg-bg/80 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-xl border-t border-brand-100/30"
    >
      <div className="mx-auto max-w-md rounded-xl bg-surface/85 shadow-soft px-2 py-2 flex items-center backdrop-blur-sm">
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
    </nav>
  );
}
