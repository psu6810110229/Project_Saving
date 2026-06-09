import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { IconButton } from '../IconButton/IconButton';
import { IconX } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { useOpenClosePrimaryMotion } from '../../lib/animationBudget';
import { FADE_TRANSITION, SPRING } from '../../lib/motion';

type ModalChildren = ReactNode | (() => ReactNode);

interface ModalProps {
  open: boolean;
  title: string;
  children: ModalChildren;
  onClose: () => void;
  headerAccessory?: ReactNode;
  hidden?: boolean;
  panelClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  closeOnBackdrop?: boolean;
  deferContentUntilOpen?: boolean;
  deferredBodyReserveClassName?: string;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  headerAccessory,
  hidden = false,
  panelClassName = '',
  headerClassName = '',
  bodyClassName = '',
  closeOnBackdrop = true,
  deferContentUntilOpen = false,
  deferredBodyReserveClassName = '',
}: ModalProps) {
  const { copy } = useI18n();
  useBodyScrollLock(open && !hidden);
  const deferredContentReady = useOpenClosePrimaryMotion(
    open && deferContentUntilOpen,
    140,
    320,
    'modal-opening',
    'modal-closing',
    deferContentUntilOpen,
  );
  const shouldRenderContent = !deferContentUntilOpen || deferredContentReady;
  const bodyClasses = deferContentUntilOpen
    ? deferredBodyReserveClassName
    : bodyClassName;

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
            onClick={hidden || !closeOnBackdrop ? undefined : onClose}
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
              className={`relative pointer-events-auto flex max-h-[60dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-bg p-4 shadow-neuRaised md:rounded-xl md:p-5 ${panelClassName}`}
              initial={{ opacity: 0, y: 28, scale: 0.95 }}
              animate={{ opacity: hidden ? 0 : 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={SPRING.modal}
            >
              <div className="flex min-h-0 flex-1 flex-col">
                <header className={`mb-4 flex shrink-0 items-center justify-between gap-3 ${headerClassName}`}>
                  <h2 id="modal-title" className="min-w-0 flex-1 font-mono text-xl font-semibold text-ink">{title}</h2>
                  <div className="flex shrink-0 items-center gap-2">
                    {headerAccessory}
                    <IconButton ariaLabel={copy.common.close} size="sm" onClick={onClose}>
                      <IconX size={18} />
                    </IconButton>
                  </div>
                </header>
                <div
                  className={`min-h-0 flex-1 overflow-y-auto ${bodyClasses}`}
                  aria-busy={deferContentUntilOpen && !deferredContentReady ? true : undefined}
                >
                  {deferContentUntilOpen ? (
                    <AnimatePresence initial={false}>
                      {shouldRenderContent && (
                        <motion.div
                          key="deferred-modal-content"
                          className={bodyClassName}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={SPRING.content}
                        >
                          {typeof children === 'function' ? children() : children}
                        </motion.div>
                      )
                      }
                    </AnimatePresence>
                  ) : (
                    typeof children === 'function' ? children() : children
                  )}
                </div>
              </div>
            </motion.section>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
