import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MOTION_DURATION, MOTION_EASE, REDUCED_MOTION_TRANSITION } from '../../lib/motion';
import { WizardProgress } from './WizardProgress';
import { StepBasics } from './StepBasics';
import { StepEventDate } from './StepEventDate';
import { StepExpenses } from './StepExpenses';
import { StepTimeline } from './StepTimeline';
import { StepSummary } from './StepSummary';
import {
  IconArrowLeft,
  IconArrowRight,
  IconBriefcase,
  IconHeart,
  IconHome,
  IconPlane,
  IconSmartphone,
} from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { Button } from '../Button/Button';
import { Modal } from '../Modal/Modal';
import { useI18n } from '../../i18n/useI18n';
import { WIZARD_DRAFT_KEY } from '../../lib/wizardDraft';
import { cascadeExpenseSchedule, suggestExpenses } from '../../lib/travelExpenseRules';
import type { ExpenseDraftItem, WizardDraft } from './wizardTypes';

const TOTAL_STEPS = 5;
const MIN_BUDGET = 500;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildInitialExpenses(endDate: string): ExpenseDraftItem[] {
  if (!endDate) return [];
  // No budget yet → suggested categories appear with empty amounts; the user's
  // budget entry on step 3 fills them in (StepExpenses.handleBudgetChange).
  const suggested = suggestExpenses(0, endDate);
  return suggested.map(s => ({
    id: s.category,
    category: s.category,
    nameEn: s.nameEn,
    nameTh: s.nameTh,
    targetAmount: 0,
    deadline: s.deadline,
    checked: true,
    isCustom: false,
    tipKey: s.tipKey,
    priority: s.priority,
    paymentType: s.paymentType,
  }));
}

function loadDraft(): WizardDraft {
  try {
    // Purge any draft left in localStorage by older builds — the draft is now
    // session-scoped, so a leftover localStorage entry would only be stale.
    localStorage.removeItem(WIZARD_DRAFT_KEY);
  } catch { /* ignore */ }
  try {
    const raw = sessionStorage.getItem(WIZARD_DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.step === 'number') {
        return { coverImageUrl: null, ...parsed } as WizardDraft;
      }
    }
  } catch { /* ignore corrupt data */ }
  return { step: 1, name: '', category: 'travel', endDate: '', coverImageUrl: null, totalBudget: 0, expenses: [] };
}

function saveDraft(draft: WizardDraft) {
  try {
    sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage full — non-critical */ }
}

const slideTransition = {
  type: 'tween' as const,
  duration: MOTION_DURATION.fade,
  ease: MOTION_EASE.emphasized,
};

export function CreateRoomWizard() {
  const navigate = useNavigate();
  const { copy } = useI18n();
  const c = copy.createRoomWizard;
  const reduceMotion = useReducedMotion();

  const [draft, setDraft] = useState(loadDraft);
  const [direction, setDirection] = useState(1);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const goTo = useCallback((step: number) => {
    setDirection(step > draft.step ? 1 : -1);
    setDraft(prev => ({ ...prev, step }));
  }, [draft.step]);

  const goToStep3 = useCallback(() => {
    setDirection(1);
    setDraft(prev => {
      const needsInit = prev.expenses.length === 0 && prev.endDate;
      const expenses = needsInit
        ? buildInitialExpenses(prev.endDate)
        : prev.expenses;
      return { ...prev, step: 3, expenses };
    });
  }, []);

  // Entering step 4: lay the selected buckets on one sequential timeline so the
  // suggested deadlines spread evenly across the runway (collect-first order),
  // keeping every bucket's daily amount affordable instead of cramming the
  // nearest deadline into a tiny, impossible window.
  const goToStep4 = useCallback(() => {
    setDirection(1);
    setDraft(prev => {
      const checked = prev.expenses.filter(e => e.checked);
      if (checked.length === 0 || !prev.endDate) {
        return { ...prev, step: 4 };
      }
      const { legs } = cascadeExpenseSchedule(
        checked.map(e => ({ id: e.id, targetAmount: e.targetAmount, priority: e.priority })),
        prev.endDate,
      );
      const byId = new Map(legs.map(leg => [leg.id, leg]));
      const expenses = prev.expenses.map(e => {
        const leg = byId.get(e.id);
        if (!leg) return e;
        return { ...e, deadline: leg.deadline, savingWindowStart: leg.startDate };
      });
      return { ...prev, step: 4, expenses };
    });
  }, []);

  // Only Travel and Gadget are live today; the rest are shown as "coming soon"
  // so users see the roadmap without being able to pick an unsupported flow.
  const categoryOptions = useMemo(() => [
    { id: 'travel' as const, label: copy.profile.projectCategories.travel, icon: <IconPlane size={28} /> },
    { id: 'gadget' as const, label: copy.profile.projectCategories.gadget, icon: <IconSmartphone size={28} /> },
    { id: 'wedding' as const, label: copy.profile.projectCategories.wedding, icon: <IconHeart size={28} />, disabled: true },
    { id: 'home' as const, label: copy.profile.projectCategories.home, icon: <IconHome size={28} />, disabled: true },
    { id: 'other' as const, label: copy.profile.projectCategories.other, icon: <IconBriefcase size={28} />, disabled: true },
  ], [copy.profile.projectCategories]);

  // Top-left arrow walks back one wizard step ("previous page"); only from the
  // first step does it leave the wizard for the previous page (the welcome
  // screen). This replaces the per-step Back buttons at the bottom of each step.
  function handleBack() {
    if (draft.step > 1) {
      goTo(draft.step - 1);
    } else {
      navigate(-1);
    }
  }

  // Whether the current step's input is complete enough to advance. Drives the
  // disabled state of the Next pill in the header (steps 1–4; step 5 creates).
  const canAdvance =
    draft.step === 1 ? draft.name.trim().length > 0
    : draft.step === 2 ? draft.endDate > todayKey()
    : draft.step === 3 ? draft.totalBudget > 0
    : draft.step === 4 ? true
    : false;

  // Step-3 guardrails surfaced as a popup on Next (the Next pill is already
  // disabled until a budget is entered). Returns the message to show, or null.
  function validateStep3(): string | null {
    if (draft.totalBudget < MIN_BUDGET) return c.validationMinBudget;
    const checked = draft.expenses.filter(e => e.checked);
    if (checked.length === 0) return c.validationNoBucket;
    if (checked.some(e => e.nameEn.trim().length === 0 || e.nameTh.trim().length === 0)) {
      return c.validationBlankBucket;
    }
    const sum = checked.reduce((acc, e) => acc + e.targetAmount, 0);
    if (sum === 0) return c.validationNoAmounts;
    if (sum > draft.totalBudget) return c.validationBudgetExceeded;
    return null;
  }

  function handleNext() {
    switch (draft.step) {
      case 1: goTo(2); break;
      case 2: goToStep3(); break;
      case 3: {
        const msg = validateStep3();
        if (msg) {
          setValidationMsg(msg);
          return;
        }
        goToStep4();
        break;
      }
      case 4: goTo(5); break;
    }
  }

  let stepContent: ReactNode;
  switch (draft.step) {
    case 1:
      stepContent = (
        <StepBasics
          name={draft.name}
          category={draft.category}
          options={categoryOptions}
          onNameChange={name => setDraft(prev => ({ ...prev, name }))}
          onCategoryChange={category => setDraft(prev => ({ ...prev, category }))}
        />
      );
      break;
    case 2:
      stepContent = (
        <StepEventDate
          endDate={draft.endDate}
          category={draft.category}
          coverImageUrl={draft.coverImageUrl}
          onEndDateChange={endDate => setDraft(prev => ({ ...prev, endDate }))}
          onCoverImageChange={coverImageUrl => setDraft(prev => ({ ...prev, coverImageUrl }))}
        />
      );
      break;
    case 3:
      stepContent = (
        <StepExpenses
          endDate={draft.endDate}
          totalBudget={draft.totalBudget}
          expenses={draft.expenses}
          onTotalBudgetChange={totalBudget => setDraft(prev => ({ ...prev, totalBudget }))}
          onExpensesChange={expenses => setDraft(prev => ({ ...prev, expenses }))}
        />
      );
      break;
    case 4:
      stepContent = (
        <StepTimeline
          eventDate={draft.endDate}
          expenses={draft.expenses}
          onExpensesChange={expenses => setDraft(prev => ({ ...prev, expenses }))}
        />
      );
      break;
    case 5:
      stepContent = (
        <StepSummary
          name={draft.name}
          category={draft.category}
          endDate={draft.endDate}
          coverImageUrl={draft.coverImageUrl}
          totalBudget={draft.totalBudget}
          expenses={draft.expenses}
        />
      );
      break;
    default:
      stepContent = null;
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg">
      <header className="sticky top-0 z-10 bg-bg/80 px-5 pb-3 pt-9 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-brand-50 hover:text-ink"
              aria-label={copy.common.back}
            >
              <IconArrowLeft size={20} />
            </button>
            <SectionLabel tone="brand">{c.headerLabel}</SectionLabel>
          </div>
          {draft.step < TOTAL_STEPS && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance}
              className="inline-flex items-center gap-1 rounded-pill bg-brand-500 px-4 py-1.5 font-mono text-sm font-bold text-ink-inverse shadow-soft transition active:scale-95 disabled:opacity-40 disabled:active:scale-100"
            >
              {c.nextButton}
              <IconArrowRight size={16} />
            </button>
          )}
        </div>
        <div className="mt-3">
          <WizardProgress current={draft.step} total={TOTAL_STEPS} />
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-hidden px-5 pb-8">
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

      <Modal
        open={validationMsg !== null}
        title={c.validationTitle}
        onClose={() => setValidationMsg(null)}
      >
        <div className="flex flex-col gap-4">
          <p className="font-mono text-sm leading-6 text-ink-muted">{validationMsg}</p>
          <Button variant="primary" fullWidth onClick={() => setValidationMsg(null)}>
            {c.validationOkButton}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
