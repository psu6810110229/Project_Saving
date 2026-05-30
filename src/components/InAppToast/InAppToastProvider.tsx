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

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<InAppToastTone, { chip: string; ring: string; text: string }> = {
  neutral: {
    chip: 'bg-brand-50 text-brand-700',
    ring: 'border-brand-100/80',
    text: 'text-ink',
  },
  success: {
    chip: 'bg-[#E8F5EE] text-[#1F7A4C]',
    ring: 'border-[#CFE8DA]',
    text: 'text-ink',
  },
  warning: {
    chip: 'bg-[#FDF0E8] text-[#B5541B]',
    ring: 'border-[#F1D2BF]',
    text: 'text-ink',
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
    const toast: InAppToastItem = {
      ...options,
      id,
      tone: options.tone ?? 'neutral',
      durationMs: options.durationMs ?? DEFAULT_DURATION_MS,
    };
    setToasts(current => [...current.slice(-2), toast]);
    timeoutIdsRef.current[id] = window.setTimeout(() => {
      dismissToast(id);
    }, toast.durationMs);
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
                      'pointer-events-auto w-full rounded-[24px] border bg-[#FFF9F3] px-4 py-3 text-left shadow-[0_16px_40px_-22px_rgba(90,45,18,0.34)] '
                      + 'transition-transform active:scale-[0.985] '
                      + styles.ring
                    }
                    initial={{ opacity: 0, y: -16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.9 }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${styles.chip}`}
                      >
                        {icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`font-mono text-[13px] font-bold leading-5 ${styles.text}`}>
                          {toast.title}
                        </p>
                        {toast.body && (
                          <p className="mt-1 font-mono text-[11px] leading-4 text-ink-muted">
                            {toast.body}
                          </p>
                        )}
                      </div>
                      {toast.onPress && (
                        <span aria-hidden className="mt-1 shrink-0 text-brand-500">
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

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside an <InAppToastProvider>.');
  }
  return value;
}
