import type { ReactNode } from 'react';
import type { BucketCategory } from '../../types';
import { normalizeBucketCategory } from '../../lib/bucketCategories';
import {
  IconBed,
  IconBriefcase,
  IconFork,
  IconHome,
  IconPiggyBank,
  IconPlane,
  IconTicket,
} from '../Icon/Icon';

const ICON_MAP: Record<BucketCategory, (size: number) => ReactNode> = {
  flight: (s) => <IconPlane size={s} />,
  stay: (s) => <IconBed size={s} />,
  transport: (s) => <IconTicket size={s} />,
  food: (s) => <IconFork size={s} />,
  activities: (s) => <IconTicket size={s} />,
  shopping: (s) => <IconBriefcase size={s} />,
  buffer: (s) => <IconPiggyBank size={s} />,
  home: (s) => <IconHome size={s} />,
  other: (s) => <IconBriefcase size={s} />,
};

interface BucketCategoryIconProps {
  category: BucketCategory | string | undefined;
  size?: number;
}

export function BucketCategoryIcon({ category, size = 22 }: BucketCategoryIconProps) {
  const normalized = normalizeBucketCategory(category);
  return <>{ICON_MAP[normalized](size)}</>;
}
