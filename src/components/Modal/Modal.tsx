import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { IconButton } from '../IconButton/IconButton';
import { IconX } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { FADE_TRANSITION, SPRING } from '../../lib/motion';

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  headerAccessory?: ReactNode;
  hidden?: boolean;
}

export function Modal({ open, title, children, onClose, headerAccessory, hidden = false }: ModalProps) {
  const { copy } = useI18n();
  useBodyScrollLock(open && !hidden);

  useEffect(() => {
    if (!open || hidden) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, hidden, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            className={[
              'fixed inset-0 z-50 bg-ink/40',
              hidden ? 'pointer-events-none opacity-0' : '',
            ].join(' ')}
            initial={{ opacity: 0 }}
            animate={{ opacity: hidden ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={FADE_TRANSITION}
            onClick={hidden ? undefined : onClose}
          />

          {/* Card */}
          <motion.div
            key="modal-card"
            className={[
              'fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 pt-10 pointer-events-none md:items-center md:p-6',
              hidden ? 'invisible' : '',
            ].join(' ')}
            aria-hidden={hidden}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              className="relative pointer-events-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg p-4 shadow-neuRaised md:rounded-xl md:p-5"
              initial={{ opacity: 0, y: 28, scale: 0.95 }}
              animate={{ opacity: hidden ? 0 : 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={SPRING.modal}
            >
              <div>
                <header className="mb-4 flex items-center justify-between gap-3">
                  <h2 id="modal-title" className="min-w-0 flex-1 font-mono text-xl font-semibold text-ink">{title}</h2>
                  <div className="flex shrink-0 items-center gap-2">
                    {headerAccessory}
                    <IconButton ariaLabel={copy.common.close} size="sm" onClick={onClose}>
                      <IconX size={18} />
                    </IconButton>
                  </div>
                </header>
                <div>{children}</div>
              </div>
            </motion.section>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
