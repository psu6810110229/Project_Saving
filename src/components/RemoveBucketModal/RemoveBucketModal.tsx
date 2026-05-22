import { useState } from 'react';
import { Button } from '../Button/Button';
import { IconArrowRight, IconTrash } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import Pressable from '../Pressable/Pressable';
import { SectionLabel } from '../SectionLabel/SectionLabel';
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
  onTransferAndArchive: (destinationId: string) => void;
  onTransferFirst: () => void;
  onViewActivity: () => void;
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
  onTransferAndArchive,
  onTransferFirst,
  onViewActivity,
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
          onTransferAndArchive={onTransferAndArchive}
          onTransferFirst={onTransferFirst}
          onViewActivity={onViewActivity}
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
  onTransferAndArchive,
  onTransferFirst,
  onViewActivity,
}: BodyProps) {
  const { copy, formatMoney } = useI18n();
  const c = copy.bucketRemove;
  const isEmpty = savedAmount <= 0;
  const noDestinations = destinations.length === 0;
  const formattedSaved = formatMoney(savedAmount);

  // Default to the first destination so the primary action is clickable
  // without an extra selection step. Body remounts (via `key` on the
  // wrapper) when the user picks a different bucket to remove.
  const [destinationId, setDestinationId] = useState<string | null>(
    destinations[0]?.id ?? null,
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-sm leading-6 text-ink-muted">
        {isEmpty
          ? c.emptyBody(bucketName)
          : noDestinations
            ? c.noDestinationsBody(bucketName, formattedSaved)
            : c.balanceBody(bucketName, formattedSaved)}
      </p>

      {!isEmpty && !noDestinations && (
        <div className="flex flex-col gap-2">
          <SectionLabel tone="brand">{c.chooseDestinationLabel}</SectionLabel>
          <div role="radiogroup" className="flex flex-col gap-2">
            {destinations.map(dest => {
              const selected = dest.id === destinationId;
              return (
                <Pressable
                  key={dest.id}
                  onClick={() => setDestinationId(dest.id)}
                  ariaLabel={dest.name}
                  disabled={pending}
                  className={[
                    'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors',
                    selected
                      ? 'border-brand-500 bg-brand-50 shadow-soft'
                      : 'border-transparent bg-surface hover:bg-brand-50/60',
                  ].join(' ')}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-mono text-sm font-bold text-ink">
                      {dest.name}
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      {c.bucketChipSaved(formatMoney(dest.saved))}
                    </span>
                  </div>
                  <div className="shrink-0 text-ink-muted">
                    <IconArrowRight size={18} />
                  </div>
                </Pressable>
              );
            })}
          </div>
        </div>
      )}

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
          <>
            <Button
              variant="primary"
              size="md"
              leadingIcon={<IconArrowRight size={16} />}
              disabled={pending || destinationId === null}
              onClick={() => {
                if (destinationId) onTransferAndArchive(destinationId);
              }}
              fullWidth
            >
              {pending ? c.transferAndRemovingButton : c.transferAndRemoveButton(formattedSaved)}
            </Button>
            <Button
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={onTransferFirst}
              fullWidth
            >
              {c.transferFirstButton}
            </Button>
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            size="md"
            disabled={pending}
            onClick={onClose}
          >
            {c.keepBucketButton}
          </Button>
          <Button
            variant="ghost"
            size="md"
            disabled={pending}
            onClick={onViewActivity}
          >
            {c.viewActivityButton}
          </Button>
        </div>
      </div>
    </div>
  );
}
