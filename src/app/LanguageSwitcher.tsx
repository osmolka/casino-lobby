import { useId } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import { LOCALES, isLocaleCode } from '../i18n/locales';
import { Select } from '../shared/Select';
import styles from './Header.module.css';

const codes = Object.keys(LOCALES).filter(isLocaleCode);

/** Renders nothing while only one locale exists (ru arrives in phase 6a). */
export function LanguageSwitcher() {
  const { t, locale, setLocale } = useI18n();
  const id = useId();
  if (codes.length < 2) return null;
  return (
    <>
      <label htmlFor={id} className="visually-hidden">
        {t('language.label')}
      </label>
      <Select
        id={id}
        className={styles.select}
        value={locale.code}
        onChange={(e) => {
          if (isLocaleCode(e.target.value)) setLocale(e.target.value);
        }}
      >
        {codes.map((code) => (
          <option key={code} value={code} lang={code}>
            {t(`language.names.${code}`)}
          </option>
        ))}
      </Select>
    </>
  );
}
