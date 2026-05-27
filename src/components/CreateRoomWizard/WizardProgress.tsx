import { motion } from 'framer-motion';
import { MOTION_DURATION, MOTION_EASE } from '../../lib/motion';

interface WizardProgressProps {
  current: number;
  total: number;
}

export function WizardProgress({ current, total }: WizardProgressProps) {
  const fraction = Math.min(current / total, 1);

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-pill bg-brand-100">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-pill bg-brand-500"
          initial={false}
          animate={{ width: `${fraction * 100}%` }}
          transition={{ type: 'tween', duration: MOTION_DURATION.fade, ease: MOTION_EASE.emphasized }}
        />
      </div>
      <span className="font-mono text-xs font-bold text-ink-muted">
        {current}/{total}
      </span>
    </div>
  );
}
