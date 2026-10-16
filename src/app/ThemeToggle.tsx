import { useI18n } from '../i18n/LocaleProvider';
import { MoonIcon, SunIcon } from '../shared/icons';
import styles from './Header.module.css';
import { useTheme } from './useTheme';

export function ThemeToggle() {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={t('theme.dark')}
      aria-pressed={dark}
      onClick={toggle}
    >
      {dark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
