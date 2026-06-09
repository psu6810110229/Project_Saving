import { useEffect, useState } from 'react';
import { Button, MODAL_ACTION_ROW_REVERSE_CLASS, MODAL_SECONDARY_BUTTON_CLASS } from '../Button/Button';
import { CalendarPicker } from '../CalendarPicker/CalendarPicker';
import { IconCalendar, IconPlayCircle } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { useI18n } from '../../i18n/useI18n';
import type { ResumePreview } from '../../types';

interface BucketResumePreviewSheetProps {
  open: boolean;
  bucketName: string;
  preview: ResumePreview | null;
  cadenceAmountLabel: string;
  getPreviewForDeadline: (deadline: string | null) => ResumePreview | null;
  getCadenceAmountLabel: (deadline: string | null) => string;
  minDeadline: string;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (deadlineOverride: string | null) => void | Promise<void>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-surfaceAlt px-3 py-2">
      <p className="truncate font-mono text-[11px] leading-tight text-ink-muted">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

export function BucketResumePreviewSheet({
  open,
  bucketName,
  preview,
  cadenceAmountLabel,
  getPreviewForDeadline,
  getCadenceAmountLabel,
  minDeadline,
  submitting = false,
  error = null,
  onClose,
  onConfirm,
}: BucketResumePreviewSheetProps) {
  const { copy, formatMoney, formatShortDateKey } = useI18n();
  const pause = copy.bucketPause;
  const [adjusting, setAdjusting] = useState(false);
  const [draftDeadline, setDraftDeadline] = useState('');

  useEffect(() => {
    if (!open) return;
    const frameId = window.requestAnimationFrame(() => {
      setAdjusting(false);
      setDraftDeadline(preview?.deadline ?? minDeadline);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [open, preview?.deadline, minDeadline]);

  const shownPreview = adjusting ? getPreviewForDeadline(draftDeadline) : preview;
  const shownCadence = adjusting ? getCadenceAmountLabel(draftDeadline) : cadenceAmountLabel;
  const shownDeadline = shownPreview?.deadline
    ? formatShortDateKey(shownPreview.deadline)
    : pause.noDeadline;
  const showPressure = shownPreview?.pressure === 'high';
  const canAdjustDeadline = Boolean(preview?.deadline);

  return (
    <Modal open={open} title={pause.resumeTitle(bucketName)} onClose={onClose}>
      {shownPreview ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-brand-100 bg-brand-50/70 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface text-brand-800 shadow-soft">
                <IconPlayCircle size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-bold text-ink">{pause.resumeSubtitle}</p>
                {showPressure && (
                  <p className="mt-1 font-mono text-xs leading-5 text-ink-muted">
                    {pause.pressureSuggestion}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat label={pause.savedLabel} value={formatMoney(shownPreview.currentBalance)} />
            <Stat label={pause.remainingLabel} value={formatMoney(shownPreview.remainingAmount)} />
            <Stat label={pause.deadlineLabel} value={shownDeadline} />
            <Stat label={pause.cadenceLabel} value={shownCadence || pause.noCadence} />
          </div>

          {adjusting && canAdjustDeadline && (
            <CalendarPicker
              value={draftDeadline}
              minDate={minDeadline}
              onChange={setDraftDeadline}
            />
          )}

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
              leadingIcon={<IconPlayCircle size={16} />}
              onClick={() => onConfirm(adjusting ? draftDeadline : null)}
              disabled={submitting || (adjusting && !draftDeadline)}
            >
              {submitting
                ? pause.resumingButton
                : adjusting
                  ? pause.resumeAdjusted
                  : pause.keepDeadline}
            </Button>
            {canAdjustDeadline ? (
              <Button
                type="button"
                variant="ghost"
                size="md"
                className={MODAL_SECONDARY_BUTTON_CLASS}
                leadingIcon={<IconCalendar size={16} />}
                onClick={() => setAdjusting(prev => !prev)}
                disabled={submitting}
              >
                {adjusting ? copy.common.cancel : pause.adjustDeadline}
              </Button>
            ) : (
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
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
