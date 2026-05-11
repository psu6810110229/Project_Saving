import type { ReactNode } from 'react';
import { SectionLabel } from '../SectionLabel/SectionLabel';

/**
 * Generic form field wrapper: tracked uppercase label on top, the input
 * (TextInput or any other control) as `children`, and an optional helper
 * or error line underneath.
 *
 * Used on Create Project, Create Bucket, Edit Profile, and Join Project.
 */

interface FormFieldProps {
  label: string;
  children: ReactNode;
  helper?: string;
  error?: string;
}

export function FormField({ label, children, helper, error }: FormFieldProps) {
  return (
    <label className="block">
      <SectionLabel tone="muted">{label}</SectionLabel>
      <div className="mt-2">{children}</div>
      {error ? (
        <span className="mt-2 block font-mono text-xs text-danger">{error}</span>
      ) : helper ? (
        <span className="mt-2 block font-mono text-xs text-ink-muted">{helper}</span>
      ) : null}
    </label>
  );
}
