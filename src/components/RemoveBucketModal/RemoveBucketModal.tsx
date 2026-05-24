import { Button } from '../Button/Button';
import { IconArrowRight, IconTrash } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { useI18n } from '../../i18n/useI18n';

export interface RemoveBucketDestination {
  id: string;
  name: string;
  saved: number;
}

interface RemoveBucketModalProps {
  open: boolean;
  bucketName: string | null;
  savedAmount: number;
  /** Active own buckets eligible to receive the balance. Caller filters out the bucket being removed. */
  destinations: RemoveBucketDestination[];
  pending: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onArchive: () => void;
  onTransferFirst: () => void;
}

export function RemoveBucketModal({
  open,
  bucketName,
  savedAmount,
  destinations,
  pending,
  errorMessage,
  onClose,
  onArchive,
  onTransferFirst,
}: RemoveBucketModalProps) {
  const { copy } = useI18n();
  const c = copy.bucketRemove;
  const isEmpty = savedAmount <= 0;
  const noDestinations = destinations.length === 0;

  const title = !bucketName
    ? c.emptyTitle('')
    : isEmpty
      ? c.emptyTitle(bucketName)
      : noDestinations
        ? c.noDestinationsTitle
        : c.balanceTitle(bucketName);

  return (
    <Modal open={open} title={title} onClose={pending ? () => {} : onClose}>
      {bucketName && (
        <RemoveBucketBody
          key={bucketName}
          bucketName={bucketName}
          savedAmount={savedAmount}
          destinations={destinations}
          pending={pending}
          errorMessage={errorMessage}
          onClose={onClose}
          onArchive={onArchive}
          onTransferFirst={onTransferFirst}
        />
      )}
    </Modal>
  );
}

interface BodyProps extends Omit<RemoveBucketModalProps, 'open' | 'bucketName'> {
  bucketName: string;
}

function RemoveBucketBody({
  bucketName,
  savedAmount,
  destinations,
  pending,
  errorMessage,
  onClose,
  onArchive,
  onTransferFirst,
}: BodyProps) {
  const { copy, formatMoney } = useI18n();
  const c = copy.bucketRemove;
  const isEmpty = savedAmount <= 0;
  const noDestinations = destinations.length === 0;
  const formattedSaved = formatMoney(savedAmount);

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-sm leading-6 text-ink-muted">
        {isEmpty
          ? c.emptyBody(bucketName)
          : noDestinations
            ? c.noDestinationsBody(bucketName, formattedSaved)
            : c.balanceBody(bucketName, formattedSaved)}
      </p>

      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger"
        >
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {isEmpty ? (
          <Button
            variant="dangerSoft"
            size="md"
            leadingIcon={<IconTrash size={16} />}
            disabled={pending}
            onClick={onArchive}
            fullWidth
          >
            {pending ? c.removingButton : c.removeEmptyButton}
          </Button>
        ) : noDestinations ? null : (
          <Button
            variant="primary"
            size="md"
            leadingIcon={<IconArrowRight size={16} />}
            disabled={pending}
            onClick={onTransferFirst}
            fullWidth
          >
            {c.transferFirstButton}
          </Button>
        )}

        <Button
          variant="ghost"
          size="md"
          disabled={pending}
          onClick={onClose}
          fullWidth
        >
          {c.keepBucketButton}
        </Button>
      </div>
    </div>
  );
}
