import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../Button/Button';
import { IconRocket } from '../Icon/Icon';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useI18n } from '../../i18n/useI18n';
import { FADE_TRANSITION, SPRING } from '../../lib/motion';
import { applyAppUpdate, subscribeAppUpdate } from '../../lib/pwaUpdate';

export function AppUpdateAvailableModal() {
  const { copy } = useI18n();
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  useBodyScrollLock(open);

  useEffect(() => subscribeAppUpdate(() => setOpen(true)), []);

  async function handleUpdate() {
    if (applying) return;
    setApplying(true);
    try {
      await applyAppUpdate();
    } catch {
      window.location.reload();
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="app-update-backdrop"
            className="fixed inset-0 z-[60] bg-ink/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE_TRANSITION}
          />
          <motion.div
            key="app-update-card"
            className="fixed inset-0 z-[60] flex items-center justify-center px-4 pointer-events-none"
          >
            <motion.section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="app-update-title"
              aria-describedby="app-update-body"
              className="relative pointer-events-auto w-full max-w-sm rounded-2xl bg-bg p-5 shadow-neuRaised"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={SPRING.modal}
            >
              <div className="flex flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-800 shadow-soft">
                  <IconRocket size={22} />
                </span>
                <h2
                  id="app-update-title"
                  className="mt-3 font-mono text-lg font-bold text-ink"
                >
                  {copy.appUpdate.title}
                </h2>
                <p
                  id="app-update-body"
                  className="mt-2 font-mono text-xs leading-5 text-ink-muted"
                >
                  {copy.appUpdate.body}
                </p>
                <div className="mt-5 w-full">
                  <Button
                    variant="action"
                    fullWidth
                    onClick={handleUpdate}
                    disabled={applying}
                  >
                    {copy.appUpdate.updateNow}
                  </Button>
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
