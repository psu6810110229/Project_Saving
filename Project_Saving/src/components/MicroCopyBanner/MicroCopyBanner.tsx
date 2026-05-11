import type { ReactNode } from 'react';
import { IconBubble } from '../IconBubble/IconBubble';

/**
 * Confirm Deposit competitive micro-copy banner. Soft peach surface with
 * a solid orange IconBubble on the left and 1-2 lines of gamified copy
 * on the right (e.g. "You're only ฿800 away from overtaking Art!").
 *
 * Three tones map to the underlying message sentiment from
 * `lib/battleNudge.ts`:
 * - `cheer`  — leading, encouraging (solid IconBubble, default).
 * - `nudge`  — behind, friendly nudge (peach IconBubble).
 * - `streak` — celebration / milestone (solid IconBubble).
 */

type Tone = 'cheer' | 'nudge' | 'streak';

interface MicroCopyBannerProps {
  icon: ReactNode;
  title: string;
  body?: string;
  tone?: Tone;
}

const TONE_BG: Record<Tone, string> = {
  cheer:  'bg-brand-50',
  nudge:  'bg-surface shadow-soft',
  streak: 'bg-brand-50',
};

export function MicroCopyBanner({ icon, title, body, tone = 'cheer' }: MicroCopyBannerProps) {
  const bubbleTone = tone === 'nudge' ? 'peach' : 'solid';
  return (
    <section className={`rounded-3xl p-4 flex items-start gap-3 ${TONE_BG[tone]}`}>
      <IconBubble tone={bubbleTone} size="lg">{icon}</IconBubble>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm font-bold text-ink">{title}</div>
        {body && <div className="mt-1 font-mono text-xs text-ink-muted">{body}</div>}
      </div>
    </section>
  );
}
