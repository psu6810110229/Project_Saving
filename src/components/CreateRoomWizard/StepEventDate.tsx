import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../Button/Button';
import { CalendarPicker } from '../CalendarPicker/CalendarPicker';
import { IconArrowLeft, IconCamera, IconImage, IconTrash } from '../Icon/Icon';
import { ImageCropper } from '../ImageCropper/ImageCropper';
import { useI18n } from '../../i18n/useI18n';
import {
  useImageUpload,
  type CropRect,
} from '../../hooks/useImageUpload';
import { roomCoverErrorMessage } from '../../lib/roomCoverImage';
import { HeroCoverPicker } from '../HeroCoverPicker/HeroCoverPicker';
import type { HeroCoverPreset } from '../../lib/heroCovers';
import type { ProjectCategory } from '../../types';

interface StepEventDateProps {
  endDate: string;
  category: ProjectCategory;
  coverImageUrl: string | null;
  onEndDateChange: (value: string) => void;
  onCoverImageChange: (value: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}

function countdownMessage(
  endDate: string,
  today: string,
  formatter: (months: number) => string,
  formatterDays: (days: number) => string,
): string | null {
  if (!endDate) return null;
  const end = new Date(endDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  if (isNaN(end.getTime())) return null;

  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return null;

  const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(totalDays / 30);

  if (months >= 1) return formatter(months);
  return formatterDays(totalDays);
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEFAULT_COVER_IMAGES: Record<ProjectCategory, string> = {
  travel: '/vault-card-japan-clean.jpg',
  gadget: '/vault-card-japan-clean.jpg',
  wedding: '/vault-card-japan-clean.jpg',
  home: '/vault-card-japan-clean.jpg',
  other: '/vault-card-japan-clean.jpg',
};

export function StepEventDate({
  endDate,
  category,
  coverImageUrl,
  onEndDateChange,
  onCoverImageChange,
  onNext,
  onBack,
}: StepEventDateProps) {
  const { copy } = useI18n();
  const c = copy.createRoomWizard;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { uploading, validateRoomCoverFile, cropAndResizeRoomCover, uploadRoomCover } = useImageUpload();
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = useMemo(() => todayKey(), []);
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const countdown = countdownMessage(endDate, today, c.countdownMonths, c.countdownDays);
  const valid = endDate > today;
  const previewUrl = coverImageUrl ?? DEFAULT_COVER_IMAGES[category];

  function handleChooseCover() {
    setCoverError(null);
    setPickerOpen(true);
  }

  function handleUploadOwn() {
    setPickerOpen(false);
    setCoverError(null);
    fileInputRef.current?.click();
  }

  function handleSelectPreset(preset: HeroCoverPreset) {
    onCoverImageChange(preset.url);
    setPickerOpen(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    if (!file) return;

    const validationError = validateRoomCoverFile(file);
    if (validationError) {
      setCoverError(roomCoverErrorMessage(validationError, c));
      return;
    }

    setCropFile(file);
  }

  async function handleApplyCrop(crop: CropRect) {
    if (!cropFile) return;

    setCoverError(null);
    try {
      const { blob } = await cropAndResizeRoomCover(cropFile, crop);
      const result = await uploadRoomCover(blob);
      if (result.errorCode || result.error || !result.url) {
        setCoverError(roomCoverErrorMessage(result.errorCode ?? 'upload_failed', c, result.error));
        return;
      }

      onCoverImageChange(result.url);
      setCropFile(null);
    } catch (error) {
      setCoverError(roomCoverErrorMessage(
        error instanceof Error && error.message === 'canvas_failed' ? 'canvas_failed' : 'decode_failed',
        c,
      ));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-mono text-2xl font-bold text-ink">{c.stepEventDateTitle}</h2>
        <p className="mt-1 font-mono text-sm text-ink-muted">{c.stepEventDateSubtitle}</p>
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-soft">
        <CalendarPicker
          value={endDate}
          onChange={onEndDateChange}
          minDate={minDate}
        />
      </div>

      {countdown && (
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-center">
          <p className="font-mono text-sm font-bold text-brand-800">{countdown}</p>
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl bg-surfaceAlt shadow-soft">
        <div className="relative aspect-[16/9] bg-brand-100/50">
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent" />
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-pill bg-surface/85 px-3 py-1.5 text-ink-muted shadow-soft backdrop-blur-sm">
            <IconImage size={14} />
            <span className="font-mono text-xs font-bold">{c.coverImagePlaceholder}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleChooseCover}
          className="absolute bottom-3 right-3 rounded-pill bg-surface/80 px-3 py-1.5 font-mono text-xs font-bold text-ink-muted shadow-soft backdrop-blur-sm disabled:opacity-50"
        >
          <IconCamera size={14} className="mr-1 inline-block align-[-2px]" />
          {c.changeCoverButton}
        </button>
        {coverImageUrl && (
          <button
            type="button"
            onClick={() => onCoverImageChange(null)}
            className="absolute bottom-3 left-3 grid h-8 w-8 place-items-center rounded-full bg-surface/80 text-ink-muted shadow-soft backdrop-blur-sm hover:text-danger"
            aria-label={c.removeCoverButton}
          >
            <IconTrash size={14} />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {coverError && (
        <p className="rounded-lg bg-danger-soft px-4 py-2 font-mono text-sm text-danger">
          {coverError}
        </p>
      )}

      <HeroCoverPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectPreset={handleSelectPreset}
        onUploadOwn={handleUploadOwn}
        selectedUrl={coverImageUrl}
      />

      {cropFile && (
        <ImageCropper
          open
          file={cropFile}
          saving={uploading}
          error={coverError}
          onCancel={() => {
            if (uploading) return;
            setCropFile(null);
          }}
          onApply={handleApplyCrop}
        />
      )}

      <div className="flex gap-3">
        <Button variant="ghost" size="lg" onClick={onBack}>
          <IconArrowLeft size={16} />
        </Button>
        <Button variant="primary" fullWidth disabled={!valid} onClick={onNext}>
          {c.nextButton}
        </Button>
      </div>
    </div>
  );
}
