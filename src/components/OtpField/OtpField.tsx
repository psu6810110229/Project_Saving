import { OtpDigitInput } from '../OtpDigitInput/OtpDigitInput';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { useI18n } from '../../i18n/useI18n';

/**
 * Form-shaped wrapper around the 6-box OtpDigitInput. Adds the
 * "JOIN CODE" label up top and an error message underneath when the
 * typed code is invalid / expired.
 */

interface OtpFieldProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  error?: string;
}

export function OtpField({ value, onChange, label, error }: OtpFieldProps) {
  const { copy } = useI18n();
  const resolvedLabel = label ?? copy.joinProject.codeLabel;
  return (
    <div>
      <SectionLabel tone="muted" className="text-center">{resolvedLabel}</SectionLabel>
      <div className="mt-3">
        <OtpDigitInput value={value} onChange={onChange} error={!!error} />
      </div>
      {error && (
        <p className="mt-3 text-center font-mono text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
