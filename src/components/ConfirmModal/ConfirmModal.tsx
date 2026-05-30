import { Button, MODAL_ACTION_ROW_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../Button/Button';
import { Modal } from '../Modal/Modal';
import { useI18n } from '../../i18n/useI18n';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const { copy } = useI18n();
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <p className="font-mono text-sm leading-6 text-ink-muted">{body}</p>
        <div className={MODAL_ACTION_ROW_CLASS}>
          <Button variant={danger ? 'dangerSoft' : 'primary'} size="md" onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" size="md" className={MODAL_SECONDARY_BUTTON_CLASS} onClick={onCancel}>{copy.common.cancel}</Button>
        </div>
      </div>
    </Modal>
  );
}
