import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { IconArrowRight, IconBell, IconCheckCircle, IconWarning } from '../Icon/Icon';

export type InAppToastTone = 'neutral' | 'success' | 'warning';

export interface InAppToastOptions {
  title: string;
  body?: string;
  tone?: InAppToastTone;
  icon?: ReactNode;
  durationMs?: number;
  onPress?: () => void;
}

interface InAppToastItem extends InAppToastOptions {
  id: string;
}

interface ToastContextValue {
  showToast: (options: InAppToastOptions) => string;
  dismissToast: (id: string) => void;
}

const DEFAULT_DURATION_MS = 4600;

// Delay before a freshly triggered toast slides in, so it does not collide
// with the action that triggered it.
const SHOW_DELAY_MS = 3000;

const ToastContext = createContext<ToastContextValue | null>(null);

// iOS notification banners carry a solid, colored app-icon squircle on a
// near-white card. `badge` fills the squircle per tone with a white glyph.
const TONE_STYLES: Record<InAppToastTone, { badge: string }> = {
  neutral: {
    badge: 'bg-brand-500 text-white',
  },
  success: {
    badge: 'bg-[#1F7A4C] text-white',
  },
  warning: {
    badge: 'bg-[#B5541B] text-white',
  },
};

function fallbackIconForTone(tone: InAppToastTone) {
  switch (tone) {
    case 'success':
      return <IconCheckCircle size={18} />;
    case 'warning':
      return <IconWarning size={18} />;
    case 'neutral':
    default:
      return <IconBell size={18} />;
  }
}

export function InAppToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<InAppToastItem[]>([]);
  const timeoutIdsRef = useRef<Record<string, number>>({});

  const dismissToast = useCallback((id: string) => {
    const timeoutId = timeoutIdsRef.current[id];
    if (typeof timeoutId === 'number') {
      window.clearTimeout(timeoutId);
      delete timeoutIdsRef.current[id];
    }
    setToasts(current => current.filter(item => item.id !== id));
  }, []);

  const showToast = useCallback((options: InAppToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const tone = options.tone ?? 'neutral';
    const toast: InAppToastItem = {
      ...options,
      id,
      tone,
      durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
    };
    // Wait SHOW_DELAY_MS before sliding the toast in, then keep it up for its
    // own duration. The show-delay timer is tracked under the same id so a
    // dismiss/unmount can cancel a toast that has not appeared yet.
    timeoutIdsRef.current[id] = window.setTimeout(() => {
      // Light haptic when a toast appears. Android fires the buzz; iOS Safari
      // has no Vibration API and ignores this, so it is Android-only in practice.
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(tone === 'warning' ? [12, 40, 12] : 12);
      }
      setToasts(current => [...current.slice(-2), toast]);
      timeoutIdsRef.current[id] = window.setTimeout(() => {
        dismissToast(id);
      }, toast.durationMs);
    }, SHOW_DELAY_MS);
    return id;
  }, [dismissToast]);

  useEffect(() => () => {
    for (const timeoutId of Object.values(timeoutIdsRef.current)) {
      window.clearTimeout(timeoutId);
    }
  }, []);

  const value = useMemo<ToastContextValue>(() => ({
    showToast,
    dismissToast,
  }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          className="pointer-events-none fixed inset-x-0 top-0 z-[120] flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+0.8rem)]"
        >
          <div className="w-full max-w-md space-y-2">
            <AnimatePresence initial={false}>
              {toasts.map(toast => {
                const tone = toast.tone ?? 'neutral';
                const styles = TONE_STYLES[tone];
                const icon = toast.icon ?? fallbackIconForTone(tone);
                const role = tone === 'warning' ? 'alert' : 'status';

                return (
                  <motion.button
                    key={toast.id}
                    type="button"
                    role={role}
                    onClick={() => {
                      toast.onPress?.();
                      dismissToast(toast.id);
                    }}
                    className={
                      'pointer-events-auto w-full rounded-[26px] bg-white px-3.5 py-3 text-left '
                      + 'shadow-[0_12px_34px_-12px_rgba(17,24,39,0.28)] '
                      + 'transition-transform active:scale-[0.985]'
                    }
                    initial={{ opacity: 0, y: -16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.9 }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={`inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] ${styles.badge}`}
                      >
                        {icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-[15px] font-semibold leading-5 text-ink">
                          {toast.title}
                        </p>
                        {toast.body && (
                          <p className="mt-0.5 font-sans text-[13px] leading-[18px] text-ink-muted">
                            {toast.body}
                          </p>
                        )}
                      </div>
                      {toast.onPress && (
                        <span aria-hidden className="shrink-0 text-ink-dim">
                          <IconArrowRight size={16} />
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside an <InAppToastProvider>.');
  }
  return value;
}
