import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button/Button';
import { ConfirmModal } from '../components/ConfirmModal/ConfirmModal';
import {
  IconBriefcase,
  IconHeart,
  IconHome,
  IconPlane,
  IconSmartphone,
} from '../components/Icon/Icon';
import { IconBubble } from '../components/IconBubble/IconBubble';
import { PageHeader } from '../components/PageHeader/PageHeader';
import { SectionLabel } from '../components/SectionLabel/SectionLabel';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { useLoadingGate } from '../hooks/useLoadingGate';
import { useRooms } from '../hooks/useRooms';
import { useI18n } from '../i18n/useI18n';
import { localDateLabel } from '../lib/format';
import type { ProjectCategory, Room } from '../types';

const CATEGORY_ICON: Record<ProjectCategory, React.ReactNode> = {
  travel: <IconPlane size={22} />,
  gadget: <IconSmartphone size={22} />,
  wedding: <IconHeart size={22} />,
  home: <IconHome size={22} />,
  other: <IconBriefcase size={22} />,
};

export function ArchivedProjects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { fetchArchivedRooms, restoreRoom } = useRooms();
  const { copy } = useI18n();
  const a = copy.archivedProjects;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Room | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { shouldShowLoader: shouldShowSkeleton } = useLoadingGate({
    loading,
    showAfterMs: 120,
    minimumVisibleMs: 400,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchArchivedRooms();
      setRooms(result);
    } catch {
      setError(a.errorTitle);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleRestore() {
    if (!confirming) return;
    setRestoringId(confirming.id);
    const result = await restoreRoom(confirming.id);
    setRestoringId(null);
    if (result.error) {
      setMessage(result.error);
      setConfirming(null);
      return;
    }
    setMessage(a.restoreSuccess);
    setConfirming(null);
    setRooms(prev => prev.filter(r => r.id !== confirming.id));
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <PageHeader
        eyebrow={a.pageEyebrow}
        title={a.pageTitle}
        subtitle={a.pageSubtitle}
        showBack
      />

      {message && (
        <p className="rounded-lg bg-brand-50 px-4 py-3 font-mono text-xs text-brand-800">{message}</p>
      )}

      {loading && shouldShowSkeleton && (
        <section className="flex flex-col gap-2" aria-label={a.loadingAriaLabel}>
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </section>
      )}

      {!loading && error && (
        <section className="rounded-xl bg-surface p-5 shadow-soft">
          <SectionLabel tone="brand">{a.listSection}</SectionLabel>
          <h2 className="mt-2 font-mono text-base font-bold text-ink">{a.errorTitle}</h2>
          <div className="mt-3">
            <Button variant="ghost" onClick={() => void load()}>{copy.common.retry}</Button>
          </div>
        </section>
      )}

      {!loading && !error && rooms.length === 0 && (
        <section className="rounded-xl bg-surface p-5 shadow-soft text-center">
          <SectionLabel tone="brand" className="text-center">{a.listSection}</SectionLabel>
          <h2 className="mt-2 font-mono text-base font-bold text-ink">{a.emptyTitle}</h2>
          <p className="mt-1 font-mono text-xs text-ink-muted">{a.emptyBody}</p>
          <div className="mt-4">
            <Button variant="ghost" onClick={() => navigate('/profile')}>{a.backToProfile}</Button>
          </div>
        </section>
      )}

      {!loading && !error && rooms.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel tone="muted">{a.listSection}</SectionLabel>
          {rooms.map(room => {
            const isCreator = Boolean(user && room.created_by === user.id);
            const isRestoring = restoringId === room.id;
            const category = room.category ?? 'other';
            return (
              <article
                key={room.id}
                className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-soft"
              >
                <div className="flex items-start gap-3">
                  <IconBubble tone="muted" size="md">{CATEGORY_ICON[category]}</IconBubble>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-mono text-base font-bold text-ink">{room.name}</h2>
                    {room.archived_at && (
                      <p className="mt-1 font-mono text-xs text-ink-muted">
                        {a.archivedOnLabel(localDateLabel(room.archived_at))}
                      </p>
                    )}
                    {room.end_date && (
                      <p className="font-mono text-xs text-ink-dim">
                        {a.endedOnLabel(localDateLabel(room.end_date))}
                      </p>
                    )}
                  </div>
                </div>
                {isCreator ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirming(room)}
                    disabled={isRestoring}
                  >
                    {isRestoring ? a.restoringButton : a.restoreButton}
                  </Button>
                ) : (
                  <p className="font-mono text-xs text-ink-dim">{a.restoreNotCreatorHint}</p>
                )}
              </article>
            );
          })}
        </section>
      )}

      <ConfirmModal
        open={Boolean(confirming)}
        title={a.restoreConfirmTitle}
        body={confirming ? a.restoreConfirmBody(confirming.name) : ''}
        confirmLabel={a.restoreConfirmLabel}
        onCancel={() => setConfirming(null)}
        onConfirm={handleRestore}
      />
    </div>
  );
}
