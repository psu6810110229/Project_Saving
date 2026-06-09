import { Button, MODAL_ACTION_ROW_REVERSE_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../Button/Button';
import { IconCalendar, IconPauseCircle } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { useI18n } from '../../i18n/useI18n';

interface BucketPauseSheetProps {
  open: boolean;
  bucketName: string;
  pauseDateLabel: string;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export function BucketPauseSheet({
  open,
  bucketName,
  pauseDateLabel,
  submitting = false,
  error = null,
  onClose,
  onConfirm,
}: BucketPauseSheetProps) {
  const { copy } = useI18n();
  const pause = copy.bucketPause;

  return (
    <Modal open={open} title={pause.pauseTitle(bucketName)} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-brand-100 bg-brand-50/70 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface text-brand-800 shadow-soft">
              <IconPauseCircle size={20} />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold text-ink">
                {pause.pauseStartsToday(pauseDateLabel)}
              </p>
              <p className="mt-1 font-mono text-xs leading-5 text-ink-muted">
                {pause.pauseBody(pauseDateLabel)}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">
            {error}
          </p>
        )}

        <div className={MODAL_ACTION_ROW_REVERSE_CLASS}>
          <Button
            type="button"
            variant="primary"
            size="md"
            leadingIcon={<IconCalendar size={16} />}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? pause.pausingButton : pause.pauseConfirm}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            className={MODAL_SECONDARY_BUTTON_CLASS}
            onClick={onClose}
            disabled={submitting}
          >
            {copy.common.cancel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
