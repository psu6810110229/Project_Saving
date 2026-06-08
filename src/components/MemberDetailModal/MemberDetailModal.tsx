import { memo, useMemo } from 'react';
import { Avatar } from '../Avatar/Avatar';
import { BucketCategoryIcon } from '../BucketCategoryIcon/BucketCategoryIcon';
import { Modal } from '../Modal/Modal';
import { MemberBucketsSection, PersonalGoalSection } from '../../pages/MemberDetail';
import { useI18n } from '../../i18n/useI18n';
import { themeSwatches } from '../../lib/theme';
import type { BucketCategory, ProfileTheme } from '../../types';

/**
 * Read-only member detail shown as a popup on the Team page (replaces the
 * full-page `/members/:id` navigation for the leaderboard). Reuses the same
 * "Personal Goal" + "Buckets" sections as the standalone Member Detail page so
 * the two surfaces stay visually identical. The Saving Plan section is
 * intentionally omitted here.
 *
 * Data is fed in by the Team page (already loaded via the shared data context),
 * so this component performs no fetching.
 */

export interface MemberDetailModalMember {
  name: string;
  fallback: string;
  avatarUrl?: string | null;
  themeColor?: ProfileTheme;
  /** Recorded Deposits total for this member. */
  saved: number;
  /** Personal sub-goal target (0 when unset). */
  target: number;
  buckets: Array<{
    id: string;
    name: string;
    saved: number;
    target: number;
    category?: BucketCategory;
  }>;
}

interface MemberDetailModalProps {
  open: boolean;
  member: MemberDetailModalMember | null;
  onClose: () => void;
}

export function MemberDetailModal({ open, member, onClose }: MemberDetailModalProps) {
  const { copy } = useI18n();
  const md = copy.memberDetail;
  const themeHex = member?.themeColor ? themeSwatches[member.themeColor] : undefined;

  return (
    <Modal
      open={open && member !== null}
      title={member?.name ?? md.pageTitle}
      onClose={onClose}
      bodyClassName="flex flex-col gap-5"
      deferContentUntilOpen
      deferredBodyReserveClassName="min-h-[46dvh] md:min-h-[26rem]"
    >
      {() => member ? <MemberDetailModalBody member={member} themeHex={themeHex} /> : null}
    </Modal>
  );
}

const MemberDetailModalBody = memo(function MemberDetailModalBody({
  member,
  themeHex,
}: {
  member: MemberDetailModalMember;
  themeHex: string | undefined;
}) {
  const { copy } = useI18n();
  const md = copy.memberDetail;
  const bucketItems = useMemo(
    () => member.buckets.map(bucket => ({
      id: bucket.id,
      icon: <BucketCategoryIcon category={bucket.category} size={22} />,
      name: bucket.name,
      saved: bucket.saved,
      target: bucket.target,
      category: bucket.category,
    })),
    [member.buckets],
  );

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <Avatar size="lg" imageUrl={member.avatarUrl} fallback={member.fallback} />
        {themeHex && (
          <div
            className="h-1 w-16 rounded-pill"
            style={{ backgroundColor: themeHex }}
            aria-hidden
          />
        )}
      </div>

      <PersonalGoalSection
        saved={member.saved}
        target={member.target}
        themeColor={member.themeColor}
        sectionLabel={md.sectionPersonalGoal}
        goalUnsetBody={md.goalUnsetBody}
      />

      <MemberBucketsSection
        name={member.name}
        buckets={bucketItems}
        titleFn={md.bucketsTitle}
        subtitleFn={md.bucketsReadOnlyHint}
        emptyBody={md.bucketsEmptyBody}
      />
    </>
  );
});
