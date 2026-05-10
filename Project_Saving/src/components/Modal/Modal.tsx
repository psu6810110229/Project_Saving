import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function Modal({ open, onClose, children, title }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  // Scroll lock + focus management
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      // Focus the panel so ESC works immediately
      setTimeout(() => panelRef.current?.focus(), 0);
    } else {
      document.body.style.overflow = '';
      (previousFocus.current as HTMLElement | null)?.focus?.();
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ESC key to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center"
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="
          relative z-10 flex flex-col bg-canvas outline-none
          w-full h-full
          md:w-auto md:h-auto md:max-w-md md:w-full md:max-h-[90vh]
          md:rounded-2xl md:shadow-lg md:mx-auto md:my-8
          overflow-hidden
        "
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-ink text-xl leading-none p-1 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
