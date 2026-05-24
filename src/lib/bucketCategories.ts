import type { BucketCategory } from '../types';

export const BUCKET_CATEGORY_ORDER: BucketCategory[] = [
  'flight',
  'stay',
  'transport',
  'food',
  'activities',
  'shopping',
  'buffer',
  'home',
  'other',
];

export type BucketEssentiality =
  | 'must_have'
  | 'important'
  | 'optional'
  | 'safety'
  | 'project_specific'
  | 'unknown';

export type BucketFlexibility =
  | 'low'
  | 'medium'
  | 'high'
  | 'protected'
  | 'unknown';

export interface BucketCategoryMeta {
  id: BucketCategory;
  labelKey: BucketCategory;
  defaultNameKey: BucketCategory;
  essentiality: BucketEssentiality;
  flexibility: BucketFlexibility;
  defaultPriority: number;
  canBeSuggestedNext: boolean;
  canBeMoveSourceSuggestion: boolean;
  protectsBalance: boolean;
}

export const BUCKET_CATEGORY_META: Record<BucketCategory, BucketCategoryMeta> = {
  flight: {
    id: 'flight',
    labelKey: 'flight',
    defaultNameKey: 'flight',
    essentiality: 'must_have',
    flexibility: 'low',
    defaultPriority: 10,
    canBeSuggestedNext: true,
    canBeMoveSourceSuggestion: false,
    protectsBalance: true,
  },
  stay: {
    id: 'stay',
    labelKey: 'stay',
    defaultNameKey: 'stay',
    essentiality: 'must_have',
    flexibility: 'low',
    defaultPriority: 20,
    canBeSuggestedNext: true,
    canBeMoveSourceSuggestion: false,
    protectsBalance: true,
  },
  transport: {
    id: 'transport',
    labelKey: 'transport',
    defaultNameKey: 'transport',
    essentiality: 'important',
    flexibility: 'medium',
    defaultPriority: 30,
    canBeSuggestedNext: true,
    canBeMoveSourceSuggestion: true,
    protectsBalance: false,
  },
  food: {
    id: 'food',
    labelKey: 'food',
    defaultNameKey: 'food',
    essentiality: 'important',
    flexibility: 'medium',
    defaultPriority: 40,
    canBeSuggestedNext: true,
    canBeMoveSourceSuggestion: true,
    protectsBalance: false,
  },
  activities: {
    id: 'activities',
    labelKey: 'activities',
    defaultNameKey: 'activities',
    essentiality: 'optional',
    flexibility: 'medium',
    defaultPriority: 50,
    canBeSuggestedNext: true,
    canBeMoveSourceSuggestion: true,
    protectsBalance: false,
  },
  shopping: {
    id: 'shopping',
    labelKey: 'shopping',
    defaultNameKey: 'shopping',
    essentiality: 'optional',
    flexibility: 'high',
    defaultPriority: 60,
    canBeSuggestedNext: true,
    canBeMoveSourceSuggestion: true,
    protectsBalance: false,
  },
  home: {
    id: 'home',
    labelKey: 'home',
    defaultNameKey: 'home',
    essentiality: 'project_specific',
    flexibility: 'medium',
    defaultPriority: 70,
    canBeSuggestedNext: true,
    canBeMoveSourceSuggestion: true,
    protectsBalance: false,
  },
  other: {
    id: 'other',
    labelKey: 'other',
    defaultNameKey: 'other',
    essentiality: 'unknown',
    flexibility: 'unknown',
    defaultPriority: 80,
    canBeSuggestedNext: true,
    canBeMoveSourceSuggestion: true,
    protectsBalance: false,
  },
  buffer: {
    id: 'buffer',
    labelKey: 'buffer',
    defaultNameKey: 'buffer',
    essentiality: 'safety',
    flexibility: 'protected',
    defaultPriority: 90,
    canBeSuggestedNext: true,
    canBeMoveSourceSuggestion: false,
    protectsBalance: true,
  },
};

const LEGACY_MAP: Record<string, BucketCategory> = {
  accom: 'stay',
  dining: 'food',
  gear: 'shopping',
  travel: 'other',
};

export function normalizeBucketCategory(value: unknown): BucketCategory {
  if (typeof value !== 'string') return 'other';
  const lower = value.toLowerCase();
  if (lower in BUCKET_CATEGORY_META) return lower as BucketCategory;
  if (lower in LEGACY_MAP) return LEGACY_MAP[lower];
  return 'other';
}

interface CategoryConfidenceInput {
  category_confidence?: number;
  category?: BucketCategory;
}

export function categoryConfidence(bucket: CategoryConfidenceInput): number {
  if (bucket.category_confidence != null) return bucket.category_confidence;
  return bucket.category ? 100 : 0;
}

interface LowConfidenceInput {
  category?: BucketCategory;
  category_confidence?: number;
  category_source?: string;
}

export function isLowConfidenceCategory(bucket: LowConfidenceInput): boolean {
  if (bucket.category_source === 'inferred') return true;
  return categoryConfidence(bucket) < 80;
}
