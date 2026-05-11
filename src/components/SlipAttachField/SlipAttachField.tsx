import { useRef } from 'react';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { Chip } from '../Chip/Chip';
import { IconBubble } from '../IconBubble/IconBubble';
import { IconSlip, IconX } from '../Icon/Icon';

/**
 * Slip-attach field on the Add Money screen. Either renders an "Attach
 * slip" tap target (peach IconBubble + helper text), or — if a slip is
 * already attached — a peach "Slip Attached" chip + filename + clear (X)
 * button.
 *
 * Fully controlled: parent passes the current `file` and gets the new one
 * (or `null` on clear) via `onChange`.
 */

interface SlipAttachFieldProps {
  file: File | null;
  onChange: (next: File | null) => void;
  label?: string;
}

export function SlipAttachField({ file, onChange, label = 'Attach slip (optional)' }: SlipAttachFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <SectionLabel tone="muted">{label}</SectionLabel>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface shadow-soft p-3">
          <Chip tone="peach" icon={<IconSlip size={14} />}>Slip Attached</Chip>
          <span className="flex-1 font-mono text-xs text-ink-muted truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove slip"
            className="text-ink-muted hover:text-danger transition-colors"
          >
            <IconX size={18} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 w-full flex items-center gap-3 rounded-2xl bg-brand-50 p-3 active:scale-[0.99] transition-transform"
        >
          <IconBubble tone="peach" size="md"><IconSlip size={20} /></IconBubble>
          <span className="font-mono text-sm text-ink-muted">Tap to attach a transfer slip</span>
        </button>
      )}
    </div>
  );
}
