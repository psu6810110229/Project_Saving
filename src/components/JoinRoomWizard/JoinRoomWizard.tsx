import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MOTION_DURATION, MOTION_EASE, REDUCED_MOTION_TRANSITION } from '../../lib/motion';
import { WizardProgress } from '../CreateRoomWizard/WizardProgress';
import { StepGoal } from './StepGoal';
import { StepBuckets } from './StepBuckets';
import { StepReady } from './StepReady';
import { IconArrowLeft } from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { useI18n } from '../../i18n/useI18n';
import { supabase } from '../../lib/supabase';
import { joinWizardDraftKey } from './joinWizardDraft';
import type { ExpenseTemplate } from '../../types';

const TOTAL_STEPS = 3;

export interface JoinBucketDraft {
  id: string;
  category: string;
  name: string;
  targetAmount: number;
  deadline: string;
  accepted: boolean;
  isCustom: boolean;
  paymentType?: string;
  suggestedRuleType?: string | null;
  suggestedRuleAmount?: number | null;
}

interface JoinWizardDraft {
  step: number;
  personalGoal: number;
  buckets: JoinBucketDraft[];
}

interface JoinRoomWizardProps {
  roomId: string;
  roomGoalTarget: number | null;
  isRejoin: boolean;
  restoredBucketCount?: number;
}

function loadDraft(roomId: string): JoinWizardDraft {
  try {
    const raw = localStorage.getItem(joinWizardDraftKey(roomId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.step === 'number') return parsed as JoinWizardDraft;
    }
  } catch { /* ignore corrupt data */ }
  return { step: 1, personalGoal: 0, buckets: [] };
}

function saveDraft(roomId: string, draft: JoinWizardDraft) {
  try {
    localStorage.setItem(joinWizardDraftKey(roomId), JSON.stringify(draft));
  } catch { /* storage full — non-critical */ }
}

const slideTransition = {
  type: 'tween' as const,
  duration: MOTION_DURATION.fade,
  ease: MOTION_EASE.emphasized,
};

export function JoinRoomWizard({ roomId, roomGoalTarget, isRejoin, restoredBucketCount }: JoinRoomWizardProps) {
  const navigate = useNavigate();
  const { copy } = useI18n();
  const c = copy.joinRoomWizard;
  const reduceMotion = useReducedMotion();

  const [draft, setDraft] = useState(() => loadDraft(roomId));
  const [direction, setDirection] = useState(1);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  // The room's event date is needed to re-lay this member's buckets on a fresh
  // affordable timeline from their own join date (see StepReady).
  const [roomEndDate, setRoomEndDate] = useState<string | null>(null);

  useEffect(() => {
    saveDraft(roomId, draft);
  }, [roomId, draft]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from('rooms').select('end_date').eq('id', roomId).single();
      if (!cancelled) {
        setRoomEndDate((data?.end_date as string | null)?.slice(0, 10) ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  useEffect(() => {
    if (templatesLoaded || draft.buckets.length > 0) {
      if (templatesLoaded) return;
      const timeoutId = window.setTimeout(() => setTemplatesLoaded(true), 0);
      return () => window.clearTimeout(timeoutId);
    }
    let cancelled = false;

    async function fetchTemplates() {
      const { data } = await supabase
        .from('expense_templates')
        .select('*')
        .eq('room_id', roomId)
        .order('priority', { ascending: true });

      if (cancelled) return;

      const templates = (data ?? []) as ExpenseTemplate[];
      const buckets: JoinBucketDraft[] = templates.map(t => ({
        id: t.id,
        category: t.category,
        name: t.name,
        targetAmount: t.target_amount,
        deadline: t.deadline,
        accepted: true,
        isCustom: false,
        paymentType: t.payment_type,
        suggestedRuleType: t.suggested_rule_type,
        suggestedRuleAmount: t.suggested_rule_amount,
      }));

      setDraft(prev => ({
        ...prev,
        personalGoal: prev.personalGoal || (roomGoalTarget ?? 0),
        buckets,
      }));
      setTemplatesLoaded(true);
    }

    void fetchTemplates();
    return () => { cancelled = true; };
  }, [roomId, roomGoalTarget, templatesLoaded, draft.buckets.length]);

  const goTo = useCallback((step: number) => {
    setDirection(step > draft.step ? 1 : -1);
    setDraft(prev => ({ ...prev, step }));
  }, [draft.step]);

  function handleClose() {
    navigate(-1);
  }

  if (isRejoin) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <header className="sticky top-0 z-10 bg-bg/80 px-5 pb-3 pt-5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-brand-50 hover:text-ink"
              aria-label={c.closeLabel}
            >
              <IconArrowLeft size={20} />
            </button>
            <SectionLabel tone="brand">{c.headerLabel}</SectionLabel>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-5 px-5 pb-8">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
              <span className="text-3xl">👋</span>
            </div>
            <h2 className="font-mono text-2xl font-bold text-ink">{c.rejoinTitle}</h2>
            <p className="mt-1 font-mono text-sm text-ink-muted">{c.rejoinSubtitle}</p>
            {typeof restoredBucketCount === 'number' && restoredBucketCount > 0 && (
              <p className="mt-2 font-mono text-xs text-brand-700">
                {c.rejoinBuckets(restoredBucketCount)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full rounded-xl bg-brand-500 px-5 py-3 font-mono text-sm font-bold text-white shadow-neuRaised hover:bg-brand-600"
          >
            {c.goToDashboard}
          </button>
        </main>
      </div>
    );
  }

  let stepContent: ReactNode;
  switch (draft.step) {
    case 1:
      stepContent = (
        <StepGoal
          personalGoal={draft.personalGoal}
          roomGoalTarget={roomGoalTarget}
          onGoalChange={personalGoal => setDraft(prev => ({ ...prev, personalGoal }))}
          onNext={() => goTo(2)}
        />
      );
      break;
    case 2:
      stepContent = (
        <StepBuckets
          buckets={draft.buckets}
          onBucketsChange={buckets => setDraft(prev => ({ ...prev, buckets }))}
          onNext={() => goTo(3)}
          onBack={() => goTo(1)}
        />
      );
      break;
    case 3:
      stepContent = (
        <StepReady
          roomId={roomId}
          personalGoal={draft.personalGoal}
          buckets={draft.buckets}
          roomEndDate={roomEndDate}
          onBack={() => goTo(2)}
        />
      );
      break;
    default:
      stepContent = null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-10 bg-bg/80 px-5 pb-3 pt-5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-brand-50 hover:text-ink"
            aria-label={c.closeLabel}
          >
            <IconArrowLeft size={20} />
          </button>
          <SectionLabel tone="brand">{c.headerLabel}</SectionLabel>
        </div>
        <div className="mt-3">
          <WizardProgress current={draft.step} total={TOTAL_STEPS} />
        </div>
      </header>

      <main className="flex-1 overflow-hidden px-5 pb-8">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={draft.step}
            custom={direction}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? 40 : -40 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -20 : 20 }}
            transition={reduceMotion ? REDUCED_MOTION_TRANSITION : slideTransition}
          >
            {stepContent}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
