import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  isLanguage,
  type Language,
} from './languages';
import { messagesByLanguage } from './messages';
import {
  formatLocalDateLabel as formatLocalDateLabelImpl,
  formatMoney as formatMoneyImpl,
  formatRelativeTime as formatRelativeTimeImpl,
  formatShortDateKey as formatShortDateKeyImpl,
} from './formatters';
import { I18nContext, type I18nContextValue } from './I18nContext';

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  });

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Ignore storage failures; in-memory state still keeps the UI coherent.
    }
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const copy = messagesByLanguage[language] ?? messagesByLanguage[DEFAULT_LANGUAGE];
    return {
      language,
      setLanguage,
      copy,
      formatMoney: (amount: number) => formatMoneyImpl(amount, language),
      formatRelativeTime: (iso: string) => formatRelativeTimeImpl(iso, language),
      formatLocalDateLabel: (iso: string) => formatLocalDateLabelImpl(iso, language),
      formatShortDateKey: (dateKey: string) => formatShortDateKeyImpl(dateKey, language),
    };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
