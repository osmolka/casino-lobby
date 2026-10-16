import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { storageSet } from '../shared/storage';
import { DEFAULT_LOCALE, LOCALES, LOCALE_KEY, isLocaleCode, type Locale, type LocaleCode } from './locales';
import { translate, type Vars } from './t';
import type { MessageKey } from './types';

interface I18n {
  locale: Locale;
  setLocale: (code: LocaleCode) => void;
  t: (key: MessageKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18n | null>(null);

/** The inline script in index.html has already validated and applied the stored locale to <html lang>. */
function initialLocale(): LocaleCode {
  const lang = document.documentElement.lang;
  return isLocaleCode(lang) ? lang : DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<LocaleCode>(initialLocale);
  const locale = LOCALES[code];

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale.code;
    root.dir = locale.dir;
  }, [locale]);

  const setLocale = useCallback((next: LocaleCode) => {
    setCode(next);
    storageSet(LOCALE_KEY, next);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale.messages, locale.code, key, vars),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <LocaleProvider>');
  return ctx;
}
