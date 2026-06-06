import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import { IconCamera, IconCheck } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { HERO_COVER_PRESETS, normalizeHeroCoverUrl, type HeroCoverPreset } from '../../lib/heroCovers';

interface HeroCoverPickerProps {
  open: boolean;
  onClose: () => void;
  onSelectPreset: (preset: HeroCoverPreset) => void;
  onUploadOwn: () => void;
  saving?: boolean;
  /** Current cover url, used to mark the active preset (if any). */
  selectedUrl?: string | null;
}

export function HeroCoverPicker({
  open,
  onClose,
  onSelectPreset,
  onUploadOwn,
  saving = false,
  selectedUrl,
}: HeroCoverPickerProps) {
  const { copy } = useI18n();
  const c = copy.createRoomWizard;
  const normalizedSelectedUrl = normalizeHeroCoverUrl(selectedUrl);

  return (
    <Modal open={open} title={c.coverPickerTitle} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-ink-muted">
          {c.coverPickerPresetsLabel}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {HERO_COVER_PRESETS.map((preset, index) => {
            const active = normalizedSelectedUrl === preset.url;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={saving}
                onClick={() => onSelectPreset(preset)}
                aria-label={c.coverPickerPresetAlt(index + 1)}
                aria-pressed={active}
                className={[
                  'relative aspect-[1.586/1] overflow-hidden rounded-xl bg-well bg-cover bg-center shadow-soft transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  active ? 'ring-2 ring-brand-500' : 'hover:opacity-90',
                  saving ? 'cursor-wait opacity-60' : '',
                ].join(' ')}
                style={{ backgroundImage: `url("${preset.url}")` }}
              >
                <span className="absolute inset-0 bg-gradient-to-t from-ink/30 to-transparent" aria-hidden />
                {active && (
                  <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-ink-inverse shadow-soft">
                    <IconCheck size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Button
          variant="secondary"
          fullWidth
          disabled={saving}
          leadingIcon={<IconCamera size={18} />}
          onClick={onUploadOwn}
        >
          {c.coverPickerUploadOwn}
        </Button>
      </div>
    </Modal>
  );
}
