import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button/Button';
import { IconArrowLeft } from '../Icon/Icon';
import { useI18n } from '../../i18n/useI18n';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { clearJoinWizardDraft } from './JoinRoomWizard';
import type { JoinBucketDraft } from './JoinRoomWizard';

interface StepReadyProps {
  roomId: string;
  personalGoal: number;
  buckets: JoinBucketDraft[];
  onBack: () => void;
}

export function StepReady({ roomId, personalGoal, buckets, onBack }: StepReadyProps) {
  const navigate = useNavigate();
  const { copy } = useI18n();
  const c = copy.joinRoomWizard;
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<'prompt' | 'granted' | 'denied'>(
    typeof Notification !== 'undefined' ? Notification.permission as 'prompt' | 'granted' | 'denied' : 'denied',
  );

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
        const bucketRows = accepted.map((b, i) => ({
          user_id: userId,
          room_id: roomId,
          name: b.name,
          target_amount: b.targetAmount,
          category: b.category,
          position: i,
          deadline: b.deadline || null,
          payment_type: b.paymentType ?? 'flexible',
        }));

        const { error: bucketError } = await supabase
          .from('buckets')
          .insert(bucketRows);
        if (bucketError) {
          console.warn('[JoinWizard] bucket creation failed', bucketError);
        }
      }

      clearJoinWizardDraft(roomId);
      navigate('/dashboard');
    } catch {
      setError(c.errorGeneric);
    } finally {
      setCreating(false);
    }
  }, [userId, roomId, personalGoal, buckets, navigate, c.errorGeneric]);

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
