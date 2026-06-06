import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button/Button';
import { IconArrowLeft } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { cascadeExpenseSchedule } from '../../lib/travelExpenseRules';
import { clearJoinWizardDraft } from './joinWizardDraft';
import { useSharedData } from '../../hooks/useSharedData';
import type { JoinBucketDraft } from './JoinRoomWizard';

const BUCKET_READY_RETRY_COUNT = 8;
const BUCKET_READY_RETRY_MS = 180;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

interface StepReadyProps {
  roomId: string;
  personalGoal: number;
  buckets: JoinBucketDraft[];
  roomEndDate: string | null;
  onBack: () => void;
}

export function StepReady({ roomId, personalGoal, buckets, roomEndDate, onBack }: StepReadyProps) {
  const navigate = useNavigate();
  const { copy } = useI18n();
  const c = copy.joinRoomWizard;
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { buckets: bucketsCtx } = useSharedData();

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<'prompt' | 'granted' | 'denied'>(
    typeof Notification !== 'undefined' ? Notification.permission as 'prompt' | 'granted' | 'denied' : 'denied',
  );

  const waitForBucketsReady = useCallback(async (expectedCount: number) => {
    if (!userId || expectedCount <= 0) return;

    for (let attempt = 0; attempt < BUCKET_READY_RETRY_COUNT; attempt++) {
      const { count, error: countError } = await supabase
        .from('buckets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('room_id', roomId)
        .is('archived_at', null);

      if (!countError && (count ?? 0) >= expectedCount) return;
      await sleep(BUCKET_READY_RETRY_MS);
    }
  }, [roomId, userId]);

  const handleRequestNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result as 'prompt' | 'granted' | 'denied');
    } catch { /* browser blocked */ }
  }, []);

  const handleStart = useCallback(async () => {
    if (!userId) return;
    setCreating(true);
    setError(null);

    try {
      const startDate = new Date().toISOString().slice(0, 10);
      const { error: goalError } = await supabase
        .from('goals')
        .upsert(
          {
            user_id: userId,
            room_id: roomId,
            target_amount: personalGoal,
            start_date: startDate,
            end_date: startDate,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,room_id' },
        );
      if (goalError) {
        console.warn('[JoinWizard] goal upsert failed', goalError);
      }

      const accepted = buckets.filter(b => b.accepted);
      if (accepted.length > 0) {
        // Re-lay this member's accepted buckets on a fresh sequential timeline
        // from THEIR join date (collect-first order = the accepted order). The
        // room's inherited deadlines were computed for the creator and may now
        // be in the past or imply an unaffordable rate for a member who joins
        // later; recomputing keeps each bucket's plan affordable and on time.
        const legs = roomEndDate
          ? cascadeExpenseSchedule(
              accepted.map((b, i) => ({ id: b.id, targetAmount: b.targetAmount, priority: i })),
              roomEndDate,
              startDate,
            ).legs
          : [];
        const legById = new Map(legs.map(leg => [leg.id, leg]));
        const bucketRows = accepted.map((b, i) => {
          const leg = legById.get(b.id);
          // Cascade result when available; otherwise fall back to the inherited
          // room default (template) rule so the bucket still has a plan.
          const ruleType = leg ? leg.suggestedRule.ruleType : (b.suggestedRuleType ?? null);
          const ruleAmount = leg
            ? (leg.suggestedRule.ruleType === 'flexible' ? null : leg.suggestedRule.amount)
            : (b.suggestedRuleAmount ?? null);
          return {
            user_id: userId,
            room_id: roomId,
            name: b.name,
            target_amount: b.targetAmount,
            category: b.category,
            position: i,
            deadline: leg?.deadline ?? (b.deadline || null),
            payment_type: b.paymentType ?? 'flexible',
            saving_rule_type: ruleType,
            saving_rule_amount: ruleAmount,
          };
        });

        const { error: bucketError } = await supabase
          .from('buckets')
          .insert(bucketRows);
        if (bucketError) {
          console.warn('[JoinWizard] bucket creation failed', bucketError);
        } else {
          // Guard the first Dashboard paint from racing ahead of the new
          // member's bucket rows becoming visible to the active-buckets query.
          await waitForBucketsReady(bucketRows.length);
          // Sync the DataContext bucket cache so Dashboard renders the new
          // buckets immediately without needing a manual refresh.
          await bucketsCtx.refetch();
        }
      }

      clearJoinWizardDraft(roomId);
      navigate('/dashboard');
    } catch {
      setError(c.errorGeneric);
    } finally {
      setCreating(false);
    }
  }, [userId, roomId, personalGoal, buckets, roomEndDate, bucketsCtx, waitForBucketsReady, navigate, c.errorGeneric]);

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
          <span className="text-3xl">🚀</span>
        </div>
        <h2 className="font-mono text-2xl font-bold text-ink">{c.stepReadyTitle}</h2>
        <p className="mt-1 font-mono text-sm text-ink-muted">{c.stepReadySubtitle}</p>
      </div>

      {notifPermission === 'prompt' && (
        <button
          type="button"
          onClick={handleRequestNotifications}
          className="flex flex-col gap-1 rounded-xl bg-surface p-4 text-left shadow-soft hover:bg-brand-50"
        >
          <span className="font-mono text-sm font-bold text-ink">{c.enableNotifications}</span>
          <span className="font-mono text-xs text-ink-muted">{c.notificationHint}</span>
        </button>
      )}

      {error && (
        <p className="rounded-lg bg-danger-soft px-4 py-2 font-mono text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" size="lg" onClick={onBack} disabled={creating}>
          <IconArrowLeft size={16} />
        </Button>
        <Button variant="action" fullWidth onClick={handleStart} disabled={creating}>
          {creating ? c.settingUpButton : c.startSavingButton}
        </Button>
      </div>
    </div>
  );
}
