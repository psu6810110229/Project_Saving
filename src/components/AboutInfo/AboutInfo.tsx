import { useState } from 'react';
import { IconButton } from '../IconButton/IconButton';
import { IconInfo } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { useI18n } from '../../i18n/useI18n';

/**
 * Controlled "About / Terms / Privacy" modal. Reads the three sections
 * from i18n (`copy.about`) and renders them as scrollable paragraphs.
 * Surfaced from the login and welcome screens via the `(i)` button.
 */
export function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { copy } = useI18n();
  const a = copy.about;
  const sections = [
    { heading: a.aboutHeading, body: a.aboutBody },
    { heading: a.termsHeading, body: a.termsBody },
    { heading: a.privacyHeading, body: a.privacyBody },
  ];

  return (
    <Modal open={open} title={a.modalTitle} onClose={onClose}>
      <div className="flex flex-col gap-6">
        {sections.map(section => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h3 className="font-mono text-sm font-bold text-ink">{section.heading}</h3>
            {section.body.map((paragraph, index) => (
              <p key={index} className="font-mono text-xs leading-5 text-ink-muted">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <p className="font-mono text-[11px] text-ink-dim">{a.lastUpdated}</p>
      </div>
    </Modal>
  );
}

type IconButtonVariant = 'ghost' | 'solid' | 'glass';
type IconButtonSize = 'sm' | 'md' | 'lg';

/**
 * Self-contained `(i)` info button that owns its own modal state. Drop it
 * into a header to give users a way to read what the app is for plus the
 * terms and privacy notice.
 */
export function AboutInfo({
  variant = 'ghost',
  size = 'md',
  className = '',
}: {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  className?: string;
}) {
  const { copy } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        ariaLabel={copy.about.infoAriaLabel}
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <IconInfo size={20} />
      </IconButton>
      <AboutModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
