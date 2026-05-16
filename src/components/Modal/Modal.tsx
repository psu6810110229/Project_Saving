import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { IconButton } from '../IconButton/IconButton';
import { IconX } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { FADE_TRANSITION, SPRING } from '../../lib/motion';

const contentVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: SPRING.content },
};

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({ open, title, children, onClose }: ModalProps) {
  const { copy } = useI18n();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE_TRANSITION}
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            key="modal-card"
            className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 pt-10 pointer-events-none md:items-center md:p-6"
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              className="relative pointer-events-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg p-4 shadow-neuRaised md:rounded-xl md:p-5"
              initial={{ opacity: 0, y: 28, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={SPRING.modal}
            >
              <motion.div
                variants={contentVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.header variants={itemVariants} className="mb-4 flex items-center justify-between gap-3">
                  <h2 id="modal-title" className="font-mono text-xl font-bold text-ink">{title}</h2>
                  <IconButton ariaLabel={copy.common.close} size="sm" onClick={onClose}>
                    <IconX size={18} />
                  </IconButton>
                </motion.header>
                <motion.div variants={itemVariants}>
                  {children}
                </motion.div>
              </motion.div>
            </motion.section>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
