import type { ReactNode } from 'react';
import { Avatar } from '../Avatar/Avatar';
import { Chip } from '../Chip/Chip';
import { IconBubble } from '../IconBubble/IconBubble';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import {
  IconBriefcase,
  IconCalendar,
  IconFlag,
  IconHeart,
  IconHome,
  IconPlane,
  IconSmartphone,
  IconUser,
} from '../Icon/Icon';
import { formatCurrency } from '../../lib/format';
import { useI18n } from '../../i18n/useI18n';
import type { ProjectCategory } from '../../types';
import type { RoomPreviewStatus } from '../../hooks/useRooms';

/**
 * Animated "preview" card shown after a valid join code is typed in.
 * Renders the real room behind the code (migration 0077's
 * room_preview_by_code RPC): category-correct icon, project name,
 * creator, the room goal + target date, and a live member count.
 * The footer chip reflects whether the caller can join, is already a
 * member, or the room is full so the preview agrees with the button.
 */

const CATEGORY_ICON: Record<ProjectCategory, ReactNode> = {
  travel: <IconPlane size={32} />,
  gadget: <IconSmartphone size={32} />,
  wedding: <IconHeart size={32} />,
  home: <IconHome size={32} />,
  other: <IconBriefcase size={32} />,
};

const MEMBER_CAP = 7;

interface ProjectPreviewCardProps {
  name: string;
  category: ProjectCategory;
  creatorName: string;
  creatorFallback: string;
  creatorAvatarUrl?: string | null;
  targetAmount: number;
  endDate?: string | null;
  memberCount: number;
  status: RoomPreviewStatus;
}

export function ProjectPreviewCard({
  name,
  category,
  creatorName,
  creatorFallback,
  creatorAvatarUrl,
  targetAmount,
  endDate,
  memberCount,
  status,
}: ProjectPreviewCardProps) {
  const { copy, language } = useI18n();
  const jp = copy.joinProject;

  const dateLabel = endDate
    ? new Date(endDate).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <section className="rounded-xl bg-surface shadow-soft p-5 flex flex-col items-center text-center gap-4">
      <IconBubble tone="solid" size="xl">{CATEGORY_ICON[category]}</IconBubble>

      <div>
        <SectionLabel tone="brand">{jp.projectFound}</SectionLabel>
        <h3 className="mt-1 font-mono text-xl font-bold text-ink">{name}</h3>
      </div>

      <div className="flex items-center gap-2">
        <Avatar size="sm" fallback={creatorFallback} imageUrl={creatorAvatarUrl} />
        <span className="font-mono text-xs text-ink-muted">{jp.createdBy(creatorName)}</span>
      </div>

      <dl className="w-full rounded-lg bg-well px-4 py-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 font-mono text-xs text-ink-muted">
            <IconFlag size={14} />
            {jp.goalLabel}
          </dt>
          <dd className="font-mono text-sm font-bold text-ink">{formatCurrency(targetAmount)}</dd>
        </div>
        {dateLabel && (
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 font-mono text-xs text-ink-muted">
              <IconCalendar size={14} />
              {jp.targetDateLabel}
            </dt>
            <dd className="font-mono text-sm font-bold text-ink">{dateLabel}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-2 font-mono text-xs text-ink-muted">
            <IconUser size={14} />
            {jp.membersLabel}
          </dt>
          <dd className="font-mono text-sm font-bold text-ink">{memberCount} / {MEMBER_CAP}</dd>
        </div>
      </dl>

      {status === 'already_member' ? (
        <Chip tone="leaf">{jp.alreadyMemberHint}</Chip>
      ) : status === 'full' ? (
        <Chip tone="danger">{jp.fullHint}</Chip>
      ) : (
        <Chip tone="peach">{jp.slotsLeft(Math.max(MEMBER_CAP - memberCount, 0))}</Chip>
      )}
    </section>
  );
}
