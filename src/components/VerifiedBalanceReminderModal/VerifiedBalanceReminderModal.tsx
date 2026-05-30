import { Button, MODAL_ACTION_ROW_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../Button/Button';
import { IconBubble } from '../IconBubble/IconBubble';
import { IconVault } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { useI18n } from '../../i18n/useI18n';

interface VerifiedBalanceReminderModalProps {
  open: boolean;
  /** Whole days since the last checkpoint, or null if there has never been one. */
  daysSinceLast: number | null;
  onClose: () => void;
  onCheckNow: () => void;
}

/**
 * Dashboard popup that nudges the user to verify their balance once the
 * last check is at least 3 days old (or has never happened). It is mounted
 * by the Dashboard with a session-scoped flag so it does not respawn after
 * a dismissal within the same browser tab.
 */
export function VerifiedBalanceReminderModal({
  open,
  daysSinceLast,
  onClose,
  onCheckNow,
}: VerifiedBalanceReminderModalProps) {
  const { copy } = useI18n();
  const r = copy.reconcile;
  const body = daysSinceLast === null
    ? r.reminderBodyNever
    : r.reminderBodyDays(daysSinceLast);

  return (
    <Modal open={open} title={r.reminderTitle} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <IconBubble tone="peach" size="md">
            <IconVault size={20} />
          </IconBubble>
          <p className="font-mono text-sm leading-6 text-ink">{body}</p>
        </div>
        <div className={MODAL_ACTION_ROW_CLASS}>
          <Button variant="action" size="md" onClick={onCheckNow}>
            {r.reminderCheckNow}
          </Button>
          <Button variant="ghost" size="md" className={MODAL_SECONDARY_BUTTON_CLASS} onClick={onClose}>
            {r.reminderLater}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
