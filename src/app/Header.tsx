import { CommandPalette } from '../features/palette/CommandPalette';
import { WalletWidget } from '../features/wallet/WalletWidget';
import { useI18n } from '../i18n/LocaleProvider';
import { LogoMark } from '../shared/icons';
import styles from './Header.module.css';
import { SettingsMenu } from './SettingsMenu';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const { t } = useI18n();
  return (
    <header className={styles.header}>
      <a href="/" className={styles.logo} aria-label={t('app.home')}>
        <LogoMark />
        <span className={styles.logoText}>{t('app.name')}</span>
      </a>
      <div className={styles.controls} role="group" aria-label={t('header.controls')}>
        <CommandPalette />
        <WalletWidget />
        <ThemeToggle />
        <SettingsMenu />
      </div>
    </header>
  );
}
