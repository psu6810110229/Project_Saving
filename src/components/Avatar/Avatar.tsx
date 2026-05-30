import { useState, type ReactNode } from 'react';
import type { ThemeSwatch } from '../../lib/theme';

/**
 * Circular avatar atom. Supports:
 * - `imageUrl` — rendered as `<img>` if provided.
 * - `fallback` — initial / letter shown when no image (e.g. "P", "A").
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

const SIZES: Record<Size, { box: string; text: string }> = {
  sm: { box: 'w-8 h-8',  text: 'text-sm' },
  md: { box: 'w-12 h-12', text: 'text-base' },
  lg: { box: 'w-16 h-16', text: 'text-xl' },
  xl: { box: 'w-24 h-24', text: 'text-2xl' },
};

export function Avatar({
  imageUrl,
  fallback = '?',
  size = 'md',
  badge,
  className = '',
}: AvatarProps) {
  const [imageFailedUrl, setImageFailedUrl] = useState<string | null>(null);
  const hasImage = Boolean(imageUrl);
  const imageFailed = hasImage && imageFailedUrl === imageUrl;

  const dims = SIZES[size];

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <div
        className={`${dims.box} rounded-full overflow-hidden bg-brand-100 flex items-center justify-center`}
      >
        {hasImage && !imageFailed ? (
          <img
            src={imageUrl ?? undefined}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImageFailedUrl(imageUrl ?? null)}
          />
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
