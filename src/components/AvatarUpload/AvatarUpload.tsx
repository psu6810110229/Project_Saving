import { useRef, useState } from 'react';
import { Avatar } from '../Avatar/Avatar';
import { Button } from '../Button/Button';
import { useI18n } from '../../i18n/useI18n';

interface AvatarUploadProps {
  /** Current avatar URL (Google profile image, previous upload, or null). */
  avatarUrl?: string | null;
  /** Initial letter shown when no avatar exists. */
  fallback: string;
  /**
   * Called when the user picks a file. The parent handles the actual
   * upload + DB update and may return a message to display next to
   * the avatar (either a success confirmation or an error).
   */
  onUpload: (file: File) => Promise<{ error?: string }>;
  /** Disables both the preview + the button while a save is in flight elsewhere. */
  disabled?: boolean;
}

/**
 * Tiny composite that renders an Avatar + "Change photo" button.
 * The actual upload is delegated to the parent via onUpload so the
 * hook contract stays single-purpose.
 */
export function AvatarUpload({ avatarUrl, fallback, onUpload, disabled }: AvatarUploadProps) {
  const { copy } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    const result = await onUpload(file);
    setBusy(false);
    if (result.error) setMessage(result.error);
    else setMessage(copy.sharedControls.photoUpdated);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar imageUrl={avatarUrl ?? undefined} fallback={fallback} size="lg" />
      <div className="flex flex-col gap-2">
        <Button
          variant="action"
          onClick={() => inputRef.current?.click()}
          disabled={Boolean(disabled) || busy}
        >
          {busy ? copy.sharedControls.uploadingPhoto : copy.sharedControls.changePhoto}
        </Button>
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
  );
}
