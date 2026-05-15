import type { ReactNode } from 'react';
import { Avatar } from '../Avatar/Avatar';
import { Chip } from '../Chip/Chip';
import { IconBubble } from '../IconBubble/IconBubble';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { useI18n } from '../../i18n/useI18n';

/**
 * Animated "preview" card shown after a valid join code is typed in. Big
 * solid IconBubble for the project category, project name, creator avatar
 * + name, and a small "members" chip.
 */

interface ProjectPreviewCardProps {
  icon: ReactNode;
  name: string;
  creatorName: string;
  creatorFallback: string;
  creatorAvatarUrl?: string | null;
  memberCount: number;
}

export function ProjectPreviewCard({
  icon,
  name,
  creatorName,
  creatorFallback,
  creatorAvatarUrl,
  memberCount,
}: ProjectPreviewCardProps) {
  const { copy } = useI18n();
  return (
    <section className="rounded-xl bg-surface shadow-soft p-5 flex flex-col items-center text-center gap-3">
      <IconBubble tone="solid" size="xl">{icon}</IconBubble>
      <div>
        <SectionLabel tone="brand">{copy.joinProject.projectFound}</SectionLabel>
        <h3 className="mt-1 font-mono text-xl font-bold text-ink">{name}</h3>
      </div>
      <div className="flex items-center gap-2">
        <Avatar size="sm" fallback={creatorFallback} imageUrl={creatorAvatarUrl} />
        <span className="font-mono text-xs text-ink-muted">{copy.joinProject.createdBy(creatorName)}</span>
      </div>
      <Chip tone="peach">{copy.joinProject.members(memberCount)}</Chip>
    </section>
  );
}
