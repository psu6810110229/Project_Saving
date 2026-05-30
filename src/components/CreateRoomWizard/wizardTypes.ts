import type { BucketCategory, PaymentType, ProjectCategory, SavingRuleType } from '../../types';

export interface ExpenseDraftItem {
  id: string;
  category: BucketCategory;
  nameEn: string;
  nameTh: string;
  targetAmount: number;
  deadline: string;
  checked: boolean;
  isCustom: boolean;
  tipKey: string | null;
  priority: number;
  paymentType?: PaymentType;
  /** Start of this bucket's saving window in the sequential cascade (the
   *  previous bucket's deadline). Used to compute leg-based, affordable rates. */
  savingWindowStart?: string;
  /** User-chosen saving rule from step 4. Unset = use the auto suggestion. */
  savingRuleType?: SavingRuleType | null;
  savingRuleAmount?: number | null;
}

export interface WizardDraft {
  step: number;
  name: string;
  category: ProjectCategory;
  endDate: string;
  coverImageUrl: string | null;
  totalBudget: number;
  expenses: ExpenseDraftItem[];
}
