import type { ReactNode } from 'react';
import { Button } from '../Button/Button';
import { OtpField } from '../OtpField/OtpField';
import { ProjectPreviewCard } from '../ProjectPreviewCard/ProjectPreviewCard';

interface JoinProjectPreview {
  icon: ReactNode;
  name: string;
  creatorName: string;
  creatorFallback: string;
  creatorAvatarUrl?: string | null;
  memberCount: number;
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
  return (
    <section className="rounded-3xl bg-surface shadow-soft p-5 flex flex-col gap-4">
      <OtpField value={code} onChange={onCodeChange} error={error} />
      {preview && !error && <ProjectPreviewCard {...preview} />}
      <Button variant="primary" fullWidth disabled={!preview || Boolean(error)} onClick={onJoin}>
        Join Project
      </Button>
    </section>
  );
}
