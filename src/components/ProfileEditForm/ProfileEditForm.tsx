import { AvatarUpload } from '../AvatarUpload/AvatarUpload';
import { Button } from '../Button/Button';
import { FormField } from '../FormField/FormField';
import { IconEdit } from '../Icon/Icon';
import { TextInput } from '../TextInput/TextInput';
import { ThemeSwatchPicker } from '../ThemeSwatchPicker/ThemeSwatchPicker';
import { ROOM_NAME_MAX_LENGTH } from '../../lib/roomName';
import type { ThemeSwatch } from '../../lib/theme';

interface ProfileEditFormProps {
  avatarUrl?: string | null;
  fallback: string;
  displayName: string;
  displayNameLabel: string;
  saveLabel: string;
  onAvatarUpload: (file: File) => Promise<{ error?: string }>;
  onDisplayNameChange: (value: string) => void;
  onSave: () => void;
  themeValue?: ThemeSwatch;
  onThemeChange?: (next: ThemeSwatch) => void;
}

export function ProfileEditForm({
  avatarUrl,
  fallback,
  displayName,
  displayNameLabel,
  saveLabel,
  onAvatarUpload,
  onDisplayNameChange,
  onSave,
  themeValue,
  onThemeChange,
}: ProfileEditFormProps) {
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={event => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="relative -mx-1 overflow-hidden rounded-[28px] border border-brand-100/80 bg-surface px-4 py-4 shadow-soft">
        <div className="relative">
          <AvatarUpload
            avatarUrl={avatarUrl ?? null}
            fallback={fallback}
            displayName={displayName}
            onUpload={onAvatarUpload}
          />
        </div>
      </div>

      <FormField label={displayNameLabel}>
        <TextInput
          value={displayName}
          leadingIcon={<IconEdit size={16} />}
          maxLength={ROOM_NAME_MAX_LENGTH}
          onChange={event => onDisplayNameChange(event.target.value.slice(0, ROOM_NAME_MAX_LENGTH))}
          className="border-brand-100 bg-surface px-4 py-3.5 shadow-neuPressed focus-within:bg-bg"
        />
      </FormField>

      {themeValue && onThemeChange && (
        <div className="rounded-3xl bg-surfaceAlt/55 px-4 py-4">
          <ThemeSwatchPicker value={themeValue} onChange={onThemeChange} />
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        size="md"
        className="mt-1 py-3.5 text-[15px] shadow-[0_14px_28px_-12px_rgba(92,40,7,0.7)]"
      >
        {saveLabel}
      </Button>
    </form>
  );
}
