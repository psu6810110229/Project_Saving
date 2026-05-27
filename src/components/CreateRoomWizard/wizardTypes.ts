import type { BucketCategory, PaymentType, ProjectCategory } from '../../types';

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
