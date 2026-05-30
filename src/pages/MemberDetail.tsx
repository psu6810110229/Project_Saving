import { useMemo, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar/Avatar';
import { BucketGrid, type BucketGridItem } from '../components/BucketGrid/BucketGrid';
import { BucketRow } from '../components/BucketRow/BucketRow';
import { Button } from '../components/Button/Button';
import {
  IconArrowLeft,
} from '../components/Icon/Icon';
import { BucketCategoryIcon } from '../components/BucketCategoryIcon/BucketCategoryIcon';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { ProgressBar } from '../components/ProgressBar/ProgressBar';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useMemberSavingSnapshot } from '../hooks/useMemberSavingSnapshot';
import { useRoom } from '../hooks/useRoom';
import { useRoomMember } from '../hooks/useRoomMembers';
import { useRoomMembersBuckets } from '../hooks/useRoomMembersBuckets';
import { useI18n } from '../i18n/useI18n';
import { formatCurrency } from '../lib/format';
import { themeSwatches } from '../lib/theme';
import type { BucketCategory } from '../types';

function bucketIcon(category: BucketCategory | undefined): ReactNode {
  return <BucketCategoryIcon category={category} size={22} />;
}

function firstGrapheme(value: string): string {
  if (!value) return '?';
  const trimmed = value.trim();
  if (trimmed.length === 0) return '?';
  const iter = trimmed[Symbol.iterator]();
  const first = iter.next();
  if (first.done) return '?';
  return first.value.toUpperCase();
}

export function MemberDetail() {
  const { userId: rawUserId } = useParams<{ userId: string }>();
  const userId = rawUserId ?? null;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { copy, formatShortDateKey } = useI18n();
  const md = copy.memberDetail;

  // Self-URL: redirect to /profile before any data fetch / shell flash.
  if (userId && user?.id && userId === user.id) {
    return <Navigate to="/profile" replace />;
  }

  return <MemberDetailBody userId={userId} md={md} formatShortDateKey={formatShortDateKey} navigate={navigate} />;
}

interface MemberDetailBodyProps {
  userId: string | null;
  md: ReturnType<typeof useI18n>['copy']['memberDetail'];
  formatShortDateKey: ReturnType<typeof useI18n>['formatShortDateKey'];
  navigate: ReturnType<typeof useNavigate>;
}

function MemberDetailBody({ userId, md, formatShortDateKey, navigate }: MemberDetailBodyProps) {
  const { activeRoom, activeRoomId } = useRoom();
  const { member, loading: memberLoading, error: memberError } = useRoomMember(activeRoomId, userId);
  void formatShortDateKey;

  // Member-scoped data fetches. Each one is scoped to (roomId, userId)
  // and queries only fields the Member Detail page may display. Notably
  // the snapshot hook deliberately omits `note` / `slip_url` from
  // savings_logs and does not touch any balance/reconcile tables.
  const memberIds = useMemo(() => (userId ? [userId] : []), [userId]);
  const snapshot = useMemberSavingSnapshot(activeRoomId, userId);
  const { bucketsByUser, loading: bucketsLoading } = useRoomMembersBuckets(activeRoomId, memberIds);

  const memberBuckets = useMemo(() => (userId ? bucketsByUser[userId] ?? [] : []), [bucketsByUser, userId]);

  const isLoading =
    !userId ||
    memberLoading ||
    snapshot.loading ||
    bucketsLoading;

  const { shouldShowLoader: shouldShowSkeleton } = useLoadingGate({
    loading: isLoading,
    showAfterMs: 120,
    minimumVisibleMs: 400,
  });

  const memberNotFound =
    !isLoading && memberError === null && !member;
  const memberHardError =
    !isLoading
    && ((memberError !== null && !member) || snapshot.error !== null);

  // Header bits
  const memberName = member?.displayName ?? '';
  const themeColor = member?.themeColor ?? undefined;

  return (
    <div className="flex flex-col gap-6 px-5 pt-8">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1 rounded-pill bg-well px-3 py-1 font-mono text-[11px] text-ink-muted shadow-neuPressed hover:text-ink"
          aria-label={`Back to ${md.backLabel}`}
        >
          <IconArrowLeft size={14} /> {md.backLabel}
        </button>
      </div>

      {memberNotFound ? (
        <ForbiddenState md={md} onBack={() => navigate('/dashboard')} />
      ) : (
        <>
          <PageHeader
            eyebrow={md.pageEyebrow}
            title={isLoading ? md.pageTitle : memberName || md.pageTitle}
            subtitle={activeRoom ? md.subtitleMemberOf(activeRoom.name) : undefined}
          />

          {isLoading ? (
            shouldShowSkeleton ? <LoadingShell md={md} /> : null
          ) : memberHardError ? (
            <p className="rounded-lg bg-danger-soft px-4 py-3 font-mono text-xs text-danger">
              {md.errorBody}
            </p>
          ) : (
            <>
              <ProfileBand
                name={memberName}
                avatarUrl={member?.avatarUrl ?? null}
                themeColor={themeColor}
              />
              <PersonalGoalSection
                saved={snapshot.saved}
                target={snapshot.target}
                themeColor={themeColor}
                sectionLabel={md.sectionPersonalGoal}
                goalUnsetBody={md.goalUnsetBody}
              />
              <MemberBucketsSection
                name={memberName || '—'}
                buckets={memberBuckets.map(bucket => ({
                  id: bucket.id,
                  icon: bucketIcon(bucket.category),
                  name: bucket.name,
                  saved: snapshot.bucketSavedById[bucket.id] ?? 0,
                  target: bucket.target_amount,
                  category: bucket.category,
                }))}
                titleFn={md.bucketsTitle}
                subtitleFn={md.bucketsReadOnlyHint}
                emptyBody={md.bucketsEmptyBody}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function ProfileBand({
  name,
  avatarUrl,
  themeColor,
}: {
  name: string;
  avatarUrl: string | null;
  themeColor: Parameters<typeof Avatar>[0]['themeColor'];
}) {
  const fallback = firstGrapheme(name);
  const themeHex = themeColor ? themeSwatches[themeColor] : undefined;
  return (
    <section className="flex items-center gap-4 rounded-xl bg-surface p-5 shadow-soft">
      <Avatar
        size="lg"
        imageUrl={avatarUrl}
        fallback={fallback}
        ring={themeColor ? 'theme' : 'none'}
        themeColor={themeColor}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xl font-bold text-ink">{name}</p>
        {themeHex && (
          <div
            className="mt-2 h-1 w-16 rounded-pill"
            style={{ backgroundColor: themeHex }}
            aria-hidden
          />
        )}
      </div>
    </section>
  );
}

export function PersonalGoalSection({
  saved,
  target,
  themeColor,
  sectionLabel,
  goalUnsetBody,
}: {
  saved: number;
  target: number;
  themeColor: Parameters<typeof Avatar>[0]['themeColor'];
  sectionLabel: string;
  goalUnsetBody: string;
}) {
  const pct = target > 0 ? (saved / target) * 100 : 0;
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-soft">
      <h2 className="font-mono text-lg font-bold leading-tight text-ink">{sectionLabel}</h2>
      <div className="flex items-baseline gap-2 font-mono">
        <span className="text-2xl font-bold text-brand-500">{formatCurrency(saved)}</span>
        {target > 0 ? (
          <span className="text-xs text-ink-muted">/ {formatCurrency(target)}</span>
        ) : (
          <span className="text-xs text-ink-muted">{goalUnsetBody}</span>
        )}
      </div>
      <ProgressBar
        value={pct}
        tone={themeColor ? 'theme' : 'primary'}
        themeHex={themeColor ? themeSwatches[themeColor] : undefined}
        size="md"
      />
    </section>
  );
}

export function MemberBucketsSection({
  name,
  buckets,
  titleFn,
  subtitleFn,
  emptyBody,
}: {
  name: string;
  buckets: BucketGridItem[];
  titleFn: (name: string) => string;
  subtitleFn: (name: string) => string;
  emptyBody: string;
}) {
  if (buckets.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-lg font-bold leading-tight text-ink">{titleFn(name)}</h2>
        <p className="rounded-xl bg-surface px-4 py-3 font-mono text-xs text-ink-muted shadow-soft">
          {emptyBody}
        </p>
      </section>
    );
  }
  return (
    <BucketGrid
      title={titleFn(name)}
      subtitle={subtitleFn(name)}
      buckets={buckets}
      renderBucket={bucket => (
        <BucketRow
          icon={bucket.icon}
          name={bucket.name}
          saved={bucket.saved}
          target={bucket.target}
          category={bucket.category}
        />
      )}
    />
  );
}

function LoadingShell({ md }: { md: ReturnType<typeof useI18n>['copy']['memberDetail'] }) {
  return (
    <div className="flex flex-col gap-6 pt-8" aria-busy="true" aria-label={md.loadingAriaLabel}>
      <section className="flex items-center gap-4 rounded-xl bg-surface p-5 shadow-soft">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          <Skeleton className="h-5 w-32 rounded-pill" />
          <Skeleton className="h-3 w-20 rounded-pill" />
        </div>
      </section>
      <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-soft">
        <Skeleton className="h-5 w-28 rounded-pill" />
        <Skeleton className="h-4 w-40 rounded-pill" />
        <Skeleton className="h-3 w-full rounded-pill" />
      </section>
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  );
}

function ForbiddenState({
  md,
  onBack,
}: {
  md: ReturnType<typeof useI18n>['copy']['memberDetail'];
  onBack: () => void;
}) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl bg-surface p-6 text-center shadow-soft">
      <h2 className="font-mono text-lg font-bold text-ink">{md.forbiddenTitle}</h2>
      <p className="font-mono text-xs text-ink-muted">{md.forbiddenBody}</p>
      <Button variant="action" onClick={onBack}>{md.forbiddenCta}</Button>
    </section>
  );
}
