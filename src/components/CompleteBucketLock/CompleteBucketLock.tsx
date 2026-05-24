import { Button } from '../Button/Button';
import { IconArrowLeft, IconCheck } from '../Icon/Icon';

interface CompleteBucketLockProps {
  title: string;
  body?: string;
  nextLine?: string | null;
  backLabel: string;
  addAnywayLabel: string;
  onBack: () => void;
  onAddAnyway: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function CompleteBucketLock({
  title,
  body,
  nextLine,
  backLabel,
  addAnywayLabel,
  onBack,
  onAddAnyway,
  primaryAction,
}: CompleteBucketLockProps) {
  return (
    <section className="flex flex-col px-1 pt-2">
      <div className="flex flex-col items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[#D3FBE6] text-[#16855E] shadow-[0_10px_24px_rgba(22,133,94,0.12)]">
          <IconCheck size={22} strokeWidth={2} />
        </div>
        <p className="text-center font-mono text-base font-bold leading-tight text-ink">
          {title}
        </p>
        {body && (
          <p className="max-w-[18rem] text-center font-mono text-sm leading-6 text-ink-muted">
            {body}
          </p>
        )}
        {nextLine && (
          <p className="rounded-pill bg-brand-50 px-3 py-1.5 text-center font-mono text-xs font-bold text-brand-800">
            {nextLine}
          </p>
        )}
      </div>

      <div className={`grid w-full gap-3 ${primaryAction ? 'mt-8' : 'mt-12'}`}>
        {primaryAction && (
          <Button variant="action" size="md" fullWidth onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
        )}

        <div className="grid min-h-12 grid-cols-2 gap-3">
          <button
            type="button"
            className="inline-flex min-w-0 items-center justify-center gap-2 rounded-pill px-3 py-3 font-mono text-sm font-bold text-ink-muted transition-colors hover:bg-brand-50 hover:text-ink active:scale-[0.98]"
            onClick={onBack}
          >
            <IconArrowLeft size={17} />
            <span className="min-w-0 break-words leading-tight">{backLabel}</span>
          </button>
          <button
            type="button"
            className="inline-flex min-w-0 items-center justify-center rounded-pill px-3 py-3 font-mono text-sm font-bold text-ink-muted transition-colors hover:bg-brand-50 hover:text-ink active:scale-[0.98]"
            onClick={onAddAnyway}
          >
            <span className="min-w-0 break-words leading-tight">{addAnywayLabel}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
