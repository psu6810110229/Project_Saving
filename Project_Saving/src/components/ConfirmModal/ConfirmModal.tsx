import { Button } from '../Button/Button';
import { Modal } from '../Modal/Modal';

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
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <p className="font-mono text-sm leading-6 text-ink-muted">{body}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="md" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'dangerSoft' : 'primary'} size="md" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
