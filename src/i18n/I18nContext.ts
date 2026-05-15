import { createContext } from 'react';
import type { Language } from './languages';
import type { Messages } from './messages';

export interface I18nContextValue {
  language: Language;
  setLanguage: (next: Language) => void;
  copy: Messages;
  formatMoney: (amount: number) => string;
  formatRelativeTime: (iso: string) => string;
  formatLocalDateLabel: (iso: string) => string;
  formatShortDateKey: (dateKey: string) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
