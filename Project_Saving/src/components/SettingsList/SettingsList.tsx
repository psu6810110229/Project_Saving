import type { ReactNode } from 'react';
import { SectionLabel } from '../SectionLabel/SectionLabel';
import { SettingsRow } from '../SettingsRow/SettingsRow';

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
  archiveItem: SettingsListItem;
}

export function SettingsList({ label = 'Settings', items, archiveItem }: SettingsListProps) {
  return (
    <section>
      <SectionLabel tone="brand">{label}</SectionLabel>
      <div className="mt-3 flex flex-col gap-2">
        {items.map(item => (
          <SettingsRow key={item.id} {...item} />
        ))}
        <SettingsRow {...archiveItem} tone="danger" />
      </div>
    </section>
  );
}
