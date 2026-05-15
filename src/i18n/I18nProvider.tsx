import { useCallback, useMemo, useState, type ReactNode } from 'react';
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
} from './formatters';
import { I18nContext, type I18nContextValue } from './I18nContext';

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(raw)) return raw;
  } catch {
    // Storage may be unavailable (private mode, SSR) — fall through.
  }
  return DEFAULT_LANGUAGE;
}

function writeStoredLanguage(language: Language) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore — selection still applies for this session.
  }
}

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    writeStoredLanguage(next);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const copy = messagesByLanguage[language] ?? messagesByLanguage[DEFAULT_LANGUAGE];
    return {
      language,
      setLanguage,
      copy,
      formatMoney: (amount: number) => formatMoneyImpl(amount, language),
      formatRelativeTime: (iso: string) => formatRelativeTimeImpl(iso, language),
      formatLocalDateLabel: (iso: string) => formatLocalDateLabelImpl(iso, language),
    };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
