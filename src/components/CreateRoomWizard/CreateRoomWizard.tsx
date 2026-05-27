import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MOTION_DURATION, MOTION_EASE, REDUCED_MOTION_TRANSITION } from '../../lib/motion';
import { WizardProgress } from './WizardProgress';
import { StepBasics } from './StepBasics';
import { StepEventDate } from './StepEventDate';
import {
  IconArrowLeft,
  IconBriefcase,
  IconHeart,
  IconHome,
  IconPlane,
  IconSmartphone,
} from '../Icon/Icon';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { useI18n } from '../../i18n/useI18n';
import type { ProjectCategory } from '../../types';
import { WIZARD_DRAFT_KEY } from '../../lib/wizardDraft';

const TOTAL_STEPS = 5;

interface WizardDraft {
  step: number;
  name: string;
  category: ProjectCategory;
  endDate: string;
}

function loadDraft(): WizardDraft {
  try {
    const raw = localStorage.getItem(WIZARD_DRAFT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.step === 'number') return parsed as WizardDraft;
    }
  } catch { /* ignore corrupt data */ }
  return { step: 1, name: '', category: 'travel', endDate: '' };
}

function saveDraft(draft: WizardDraft) {
  try {
    localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage full — non-critical */ }
}

const slideTransition = {
  type: 'tween' as const,
  duration: MOTION_DURATION.fade,
  ease: MOTION_EASE.emphasized,
};

function StepPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-xl bg-surface p-8 shadow-soft">
      <p className="font-mono text-sm text-ink-dim">{label}</p>
    </div>
  );
}

export function CreateRoomWizard() {
  const navigate = useNavigate();
  const { copy } = useI18n();
  const c = copy.createRoomWizard;
  const reduceMotion = useReducedMotion();

  const [draft, setDraft] = useState(loadDraft);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const goTo = useCallback((step: number) => {
    setDirection(step > draft.step ? 1 : -1);
    setDraft(prev => ({ ...prev, step }));
  }, [draft.step]);

  const categoryOptions = [
    { id: 'travel' as const, label: copy.profile.projectCategories.travel, icon: <IconPlane size={28} /> },
    { id: 'gadget' as const, label: copy.profile.projectCategories.gadget, icon: <IconSmartphone size={28} /> },
    { id: 'wedding' as const, label: copy.profile.projectCategories.wedding, icon: <IconHeart size={28} /> },
    { id: 'home' as const, label: copy.profile.projectCategories.home, icon: <IconHome size={28} /> },
    { id: 'other' as const, label: copy.profile.projectCategories.other, icon: <IconBriefcase size={28} /> },
  ];

  function handleClose() {
    navigate(-1);
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
          onNext={() => goTo(2)}
        />
      );
      break;
    case 2:
      stepContent = (
        <StepEventDate
          endDate={draft.endDate}
          onEndDateChange={endDate => setDraft(prev => ({ ...prev, endDate }))}
          onNext={() => goTo(3)}
          onBack={() => goTo(1)}
        />
      );
      break;
    case 3:
      stepContent = <StepPlaceholder label={c.comingSoonStep3} />;
      break;
    case 4:
      stepContent = <StepPlaceholder label={c.comingSoonStep4} />;
      break;
    case 5:
      stepContent = <StepPlaceholder label={c.comingSoonStep5} />;
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
