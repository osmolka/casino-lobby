import { en, type Messages } from './en';

export type LocaleCode = 'en';

export interface Locale {
  code: LocaleCode;
  dir: 'ltr' | 'rtl';
  messages: Messages;
}

export const LOCALES: Record<LocaleCode, Locale> = {
  en: { code: 'en', dir: 'ltr', messages: en },
};

export const DEFAULT_LOCALE: LocaleCode = 'en';

/** Also read by the inline script in index.html — keep in sync. */
export const LOCALE_KEY = 'lobby.locale';

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && Object.hasOwn(LOCALES, value);
}
