import { en } from './locales/en';
import { th } from './locales/th';
import type { Language } from './languages';

type Loosen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
  ? readonly Loosen<U>[]
  : T extends (...args: infer A) => infer R
  ? (...args: A) => R
  : { [K in keyof T]: Loosen<T[K]> };

export type Messages = Loosen<typeof en>;

function withFallback<T>(fallback: T, override: T): T {
  if (override == null) return fallback;
  if (Array.isArray(fallback) || Array.isArray(override)) return override;
  if (typeof fallback !== 'object' || typeof override !== 'object') return override;

  const merged: Record<string, unknown> = { ...(fallback as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    const fallbackValue = (fallback as Record<string, unknown>)[key];
    merged[key] =
      fallbackValue && value && typeof fallbackValue === 'object' && typeof value === 'object'
        ? withFallback(fallbackValue, value)
        : value ?? fallbackValue;
  }
  return merged as T;
}

export const messagesByLanguage: Record<Language, Messages> = {
  en: en as Messages,
  th: withFallback(en as Messages, th),
};

export { en, th };
