import type { ReactNode } from 'react';
import { Button } from '../Button/Button';
import { OtpField } from '../OtpField/OtpField';
import { ProjectPreviewCard } from '../ProjectPreviewCard/ProjectPreviewCard';
import { useI18n } from '../../i18n/useI18n';

interface JoinProjectPreview {
  icon: ReactNode;
  name: string;
  creatorName: string;
  creatorFallback: string;
  creatorAvatarUrl?: string | null;
}

interface JoinProjectFlowProps {
  code: string;
  error?: string;
  preview: JoinProjectPreview | null;
  onCodeChange: (next: string) => void;
  onJoin: () => void;
}

export function JoinProjectFlow({
  code,
  error,
  preview,
  onCodeChange,
  onJoin,
}: JoinProjectFlowProps) {
  const { copy } = useI18n();
  return (
    <section className="rounded-xl bg-surface shadow-soft p-5 flex flex-col gap-4">
      <OtpField value={code} onChange={onCodeChange} error={error} label={copy.joinProject.codeLabel} />
      {preview && !error && <ProjectPreviewCard {...preview} />}
      <Button variant="primary" fullWidth disabled={!preview || Boolean(error)} onClick={onJoin}>
        {copy.joinProject.submitButton}
      </Button>
    </section>
  );
}
