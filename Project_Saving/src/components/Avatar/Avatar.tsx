import type { ReactNode } from 'react';
import { palette, themeSwatches, type ThemeSwatch } from '../../lib/theme';

/**
 * Circular avatar atom. Supports:
 * - `imageUrl` — rendered as `<img>` if provided.
 * - `fallback` — initial / letter shown when no image (e.g. "P", "A").
 * - `ring`     — colored ring around the avatar; `'leader'` uses brand-500
 *                + Leader badge slot, `'theme'` uses the user's theme color.
 * - `themeColor` — `ThemeSwatch` key (terracotta / slate / teal); falls back
 *                  to brand-500 when omitted.
 * - `badge`    — optional ReactNode rendered below-center (used for the
 *                "Leader" pill in Head-to-Head).
 */

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Ring = 'none' | 'leader' | 'theme';

interface AvatarProps {
  imageUrl?: string | null;
  fallback?: string;
  size?: Size;
  ring?: Ring;
  themeColor?: ThemeSwatch;
  badge?: ReactNode;
  className?: string;
}

const SIZES: Record<Size, { box: string; text: string; ring: number }> = {
  sm: { box: 'w-8 h-8',  text: 'text-sm',  ring: 2 },
  md: { box: 'w-12 h-12', text: 'text-base', ring: 2 },
  lg: { box: 'w-16 h-16', text: 'text-xl',  ring: 3 },
  xl: { box: 'w-24 h-24', text: 'text-2xl', ring: 4 },
};

export function Avatar({
  imageUrl,
  fallback = '?',
  size = 'md',
  ring = 'none',
  themeColor,
  badge,
  className = '',
}: AvatarProps) {
  const dims = SIZES[size];
  const ringColor =
    ring === 'leader'
      ? palette.brand500
      : ring === 'theme'
        ? (themeColor ? themeSwatches[themeColor] : palette.brand500)
        : 'transparent';

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <div
        className={`${dims.box} rounded-full overflow-hidden bg-brand-100 flex items-center justify-center`}
        style={ring !== 'none'
          ? { boxShadow: `0 0 0 ${dims.ring}px ${ringColor}, 0 0 0 ${dims.ring + 2}px ${palette.bg}` }
          : undefined}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className={`font-mono font-bold text-brand-800 ${dims.text}`}>{fallback}</span>
        )}
      </div>
      {badge && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
          {badge}
        </div>
      )}
    </div>
  );
}
