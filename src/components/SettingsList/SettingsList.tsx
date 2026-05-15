import type { ReactNode } from 'react';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { SettingsRow } from '../SettingsRow/SettingsRow';
import { useI18n } from '../../i18n/useI18n';

interface SettingsListItem {
  id: string;
  icon: ReactNode;
  label: string;
  description?: string;
  meta?: ReactNode;
  onClick?: () => void;
}

interface SettingsListProps {
  label?: string;
  items: SettingsListItem[];
  /**
   * Optional bottom row rendered with a danger tone. Used for the
   * Archive Project / Sign Out destructive actions. When omitted the
   * list renders without a trailing danger row.
   */
  archiveItem?: SettingsListItem;
}

export function SettingsList({ label, items, archiveItem }: SettingsListProps) {
  const { copy } = useI18n();
  const resolvedLabel = label ?? copy.sharedControls.settings;
  return (
    <section>
      <SectionLabel tone="brand">{resolvedLabel}</SectionLabel>
      <div className="mt-3 flex flex-col gap-2">
        {items.map(item => (
          <SettingsRow key={item.id} {...item} />
        ))}
        {archiveItem && <SettingsRow {...archiveItem} tone="danger" />}
      </div>
    </section>
  );
}
