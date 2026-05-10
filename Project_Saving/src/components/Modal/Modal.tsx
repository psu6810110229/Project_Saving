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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#161311]/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="
          relative z-10 flex flex-col bg-white/95 backdrop-blur-2xl outline-none
          w-full max-w-sm max-h-[90vh] rounded-[3rem] shadow-2xl
          border border-white/30
          overflow-hidden
          animate-scale-in
          text-slate-900
        "
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-3xl leading-none p-1 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
