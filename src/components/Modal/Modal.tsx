import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { IconButton } from '../IconButton/IconButton';
import { IconX } from '../Icon/Icon';

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({ open, title, children, onClose }: ModalProps) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-3 pb-3 pt-10 animate-fade-in md:items-center md:p-6">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg p-4 shadow-neuRaised animate-scale-in md:rounded-xl md:p-5"
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 id="modal-title" className="font-mono text-xl font-bold text-ink">{title}</h2>
          <IconButton ariaLabel="Close" size="sm" onClick={onClose}>
            <IconX size={18} />
          </IconButton>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
