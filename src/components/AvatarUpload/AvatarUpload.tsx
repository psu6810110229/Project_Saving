import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../Avatar/Avatar';
import { ImageCropper } from '../ImageCropper/ImageCropper';
import { IconCamera } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { useI18n } from '../../i18n/useI18n';
import { cropAndResizeAvatar, croppedAvatarFile, type CropRect } from '../../hooks/useImageUpload';

interface AvatarUploadProps {
  /** Current avatar URL (Google profile image, previous upload, or null). */
  avatarUrl?: string | null;
  /** Initial letter shown when no avatar exists. */
  fallback: string;
  /** Optional display name shown beside the avatar in richer profile editors. */
  displayName?: string;
  /**
   * Called when the user picks a file. The parent handles the actual
   * upload + DB update and may return a message to display next to
   * the avatar (either a success confirmation or an error).
   */
  onUpload: (file: File) => Promise<{ error?: string }>;
  /** Disables both the preview + the button while a save is in flight elsewhere. */
  disabled?: boolean;
  /** Optional hook for parent flows that need to lock navigation while uploading. */
  onBusyChange?: (busy: boolean) => void;
  /** Alternate stacked layout for onboarding / wizard surfaces. */
  layout?: 'inline' | 'stacked';
  /** Larger avatar treatment for immersive onboarding surfaces. */
  emphasis?: 'default' | 'hero';
}

/**
 * Tiny composite that renders an Avatar + "Change photo" button.
 * The actual upload is delegated to the parent via onUpload so the
 * hook contract stays single-purpose.
 */
export function AvatarUpload({
  avatarUrl,
  fallback,
  displayName,
  onUpload,
  disabled,
  onBusyChange,
  layout = 'inline',
  emphasis = 'default',
}: AvatarUploadProps) {
  const { copy } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (inputRef.current) inputRef.current.value = '';
    if (!file.type.startsWith('image/')) {
      const result = await onUpload(file);
      if (result.error) setMessage(result.error);
      return;
    }
    setMessage(null);
    setCropFile(file);
  }

  async function handleApplyCrop(crop: CropRect) {
    if (!cropFile) return;
    setBusy(true);
    setMessage(null);
    try {
      const blob = await cropAndResizeAvatar(cropFile, crop);
      const result = await onUpload(croppedAvatarFile(blob));
      if (result.error) setMessage(result.error);
      else {
        setMessage(copy.sharedControls.photoUpdated);
        setCropFile(null);
      }
    } catch {
      setMessage(copy.sharedControls.imageTypeError);
    } finally {
      setBusy(false);
    }
  }

  const avatarSize = layout === 'stacked' && emphasis === 'hero' ? 'xl' : 'lg';
  const cameraButtonClassName =
    layout === 'stacked' && emphasis === 'hero'
      ? 'absolute bottom-1 right-1 h-10 w-10 bg-surface/55 text-brand-700 shadow-soft ring-1 ring-brand-100 backdrop-blur-sm hover:bg-brand-50/70 disabled:opacity-50'
      : 'absolute -bottom-1 -right-1 h-8 w-8 bg-surface/50 text-brand-700 shadow-soft ring-1 ring-brand-100 backdrop-blur-sm hover:bg-brand-50/70 disabled:opacity-50';

  return (
    <>
      <div className={layout === 'stacked' ? 'flex min-w-0 flex-col items-center gap-4 text-center' : 'flex min-w-0 items-center gap-4'}>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={Boolean(disabled) || busy}
            className="rounded-full disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={copy.sharedControls.uploadProfilePhoto}
          >
            <Avatar imageUrl={avatarUrl ?? undefined} fallback={fallback} size={avatarSize} />
          </button>
          <IconButton
            type="button"
            ariaLabel={busy ? copy.sharedControls.uploadingPhoto : copy.sharedControls.changePhoto}
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={Boolean(disabled) || busy}
            className={cameraButtonClassName}
          >
            <IconCamera size={16} />
          </IconButton>
        </div>
        <div className={layout === 'stacked' ? 'flex min-w-0 w-full max-w-[14rem] flex-col items-center gap-2' : 'flex min-w-0 flex-1 flex-col gap-2'}>
          {displayName && (
            <span className={`${layout === 'stacked' ? 'text-center' : 'truncate'} font-mono text-base font-bold leading-tight text-ink`}>
              {displayName}
            </span>
          )}
          {message && <span className="font-mono text-[11px] text-ink-muted">{message}</span>}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
            aria-label={copy.sharedControls.uploadProfilePhoto}
          />
        </div>
      </div>
      <ImageCropper
        open={Boolean(cropFile)}
        file={cropFile}
        saving={busy}
        onCancel={() => {
          if (busy) return;
          setCropFile(null);
        }}
        onApply={handleApplyCrop}
        aspectRatio={1}
        title={copy.sharedControls.uploadProfilePhoto}
        applyLabel={copy.sharedControls.changePhoto}
        uploadingLabel={copy.sharedControls.uploadingPhoto}
      />
    </>
  );
}
