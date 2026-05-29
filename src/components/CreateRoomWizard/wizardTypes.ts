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
