import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../Button/Button';
import { CalendarPicker } from '../CalendarPicker/CalendarPicker';
import { HeroCard } from '../HeroCard/HeroCard';
import { IconArrowLeft, IconCamera, IconTrash } from '../Icon/Icon';
import { ImageCropper } from '../ImageCropper/ImageCropper';
import { useI18n } from '../../i18n/useI18n';
import { useProfile } from '../../hooks/useProfile';
import {
  useImageUpload,
  type CropRect,
} from '../../hooks/useImageUpload';
import { roomCoverErrorMessage } from '../../lib/roomCoverImage';
import { HeroCoverPicker } from '../HeroCoverPicker/HeroCoverPicker';
import { HERO_COVER_PRESETS, type HeroCoverPreset } from '../../lib/heroCovers';
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
  const { profile } = useProfile();
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

  const valid = endDate > today;
  const previewUrl = coverImageUrl ?? DEFAULT_COVER_IMAGES[category];
  const previewTint = useMemo(
    () => HERO_COVER_PRESETS.find(preset => preset.url === previewUrl)?.tint ?? null,
    [previewUrl],
  );
  const previewName = profile?.display_name?.trim() || copy.profile.youFallback;

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

      <div className="flex flex-col gap-3">
        <p className="font-mono-th text-xs leading-5 text-ink-muted">{c.coverPreviewHint}</p>
        <HeroCard
          displayName={previewName}
          saved={32000}
          target={100000}
          roomCategory={category}
          coverImageUrl={previewUrl}
          validThru={endDate || null}
          hasBuckets
          bucketCount={4}
          streak={5}
          streakUnit="day"
          lastCheckedAt={today}
          coverTint={previewTint}
        />
        <Button variant="secondary" fullWidth onClick={handleChooseCover}>
          <IconCamera size={16} className="mr-2 inline-block align-[-3px]" />
          {c.chooseCoverButton}
        </Button>
        {coverImageUrl && (
          <button
            type="button"
            onClick={() => onCoverImageChange(null)}
            className="inline-flex items-center gap-1.5 self-center font-mono text-xs font-bold text-ink-muted hover:text-danger"
          >
            <IconTrash size={14} />
            {c.removeCoverButton}
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
