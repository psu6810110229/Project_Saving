import { Button } from '../Button/Button';
import { OtpField } from '../OtpField/OtpField';
import { ProjectPreviewCard } from '../ProjectPreviewCard/ProjectPreviewCard';
import { IconWarning } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import type { RoomPreviewResult } from '../../hooks/useRooms';
import { fallbackInitial } from '../../lib/dashboardStats';

interface JoinProjectFlowProps {
  code: string;
  error?: string;
  preview: RoomPreviewResult | null;
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
  const jp = copy.joinProject;
  const notFound = preview?.status === 'not_found';
  const room = preview && preview.status !== 'not_found' ? preview : null;
  const canJoin = Boolean(room) && !error && room?.status === 'found';
  return (
    <section className="rounded-xl bg-surface shadow-soft p-5 flex flex-col gap-4">
      <OtpField value={code} onChange={onCodeChange} error={error} label={jp.codeLabel} />
      {room && !error && (
        <ProjectPreviewCard
          name={room.name}
          category={room.category}
          creatorName={room.creatorName ?? copy.projectSetup.projectOwner}
          creatorFallback={fallbackInitial(room.creatorName ?? undefined)}
          creatorAvatarUrl={room.creatorAvatarUrl}
          targetAmount={room.targetAmount}
          endDate={room.endDate}
          memberCount={room.memberCount}
          status={room.status}
        />
      )}
      {notFound && !error && (
        <section className="rounded-xl bg-surface shadow-soft p-5 flex flex-col items-center text-center gap-3">
          <span className="inline-flex items-center justify-center rounded-full w-20 h-20 bg-danger-soft text-danger">
            <IconWarning size={32} />
          </span>
          <div>
            <h3 className="font-mono text-lg font-bold text-ink">{jp.notFoundTitle}</h3>
            <p className="mt-1 font-mono text-xs text-ink-muted">{jp.notFoundBody}</p>
          </div>
        </section>
      )}
      <Button variant="primary" fullWidth size="md" disabled={!canJoin} onClick={onJoin}>
        {jp.submitButton}
      </Button>
    </section>
  );
}
