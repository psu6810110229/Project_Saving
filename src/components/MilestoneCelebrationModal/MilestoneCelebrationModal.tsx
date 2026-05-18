import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '../Button/Button';
import { IconBubble } from '../IconBubble/IconBubble';
import { IconPiggyBank } from '../Icon/Icon';
import { OutcomeModal } from '../OutcomeModal/OutcomeModal';
import { SPRING } from '../../lib/motion';
import { useI18n } from '../../i18n/useI18n';
import type { MilestoneThreshold } from '../../types';

/**
 * One-shot celebration modal that fires when the shared room total
 * crosses 25 / 50 / 75 / 90 percent of the target.
 *
 * Composes the existing OutcomeModal shell with a custom icon node so
 * the celebration gets a scale-in halo on the IconBubble while the
 * outer modal keeps the standard fade + spring entrance. The icon
 * animation collapses to a flat fade when prefers-reduced-motion is
 * on, matching the rest of the app's motion contract.
 *
 * Copy is plain sentence-form and threshold-specific. No emoji, no
 * marketing language — these strings live in the existing i18n
 * locale files alongside the other dashboard / addMoney copy.
 */

interface MilestoneCelebrationModalProps {
  open: boolean;
  threshold: MilestoneThreshold | null;
  onAcknowledge: () => void;
}

export function MilestoneCelebrationModal({
  open,
  threshold,
  onAcknowledge,
}: MilestoneCelebrationModalProps) {
  const { copy } = useI18n();
  const reduceMotion = useReducedMotion();
  // Threshold can briefly be null during the exit animation; fall back
  // to a safe value so the modal body keeps rendering until it unmounts.
  const t: MilestoneThreshold = threshold ?? 25;
  const m = copy.milestoneCelebration;

  const initial = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 };
  const animate = reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 };

  const animatedIcon = (
    <motion.span
      key={t}
      initial={initial}
      animate={animate}
      transition={SPRING.outcome}
      className="inline-flex"
    >
      <IconBubble tone="solid" size="xl" className="shadow-haloOrange">
        <IconPiggyBank size={36} />
      </IconBubble>
    </motion.span>
  );

  return (
    <OutcomeModal
      open={open}
      outcome="success"
      icon={animatedIcon}
      title={m.title(t)}
      body={m.body(t)}
    >
      <Button variant="action" fullWidth onClick={onAcknowledge}>
        {m.cta}
      </Button>
    </OutcomeModal>
  );
}
