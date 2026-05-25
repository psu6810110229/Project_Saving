export const SUPPORTED_LANGUAGES = ['en', 'th'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'th';

export const LANGUAGE_STORAGE_KEY = 'goout:ui-language';

export const LANGUAGE_NATIVE_LABEL: Record<Language, string> = {
  en: 'English',
  th: 'ไทย',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
