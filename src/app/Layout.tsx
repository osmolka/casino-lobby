import { useI18n } from '../i18n/LocaleProvider';
import { Skeleton } from '../shared/Skeleton';
import { FeedPanel } from './FeedPanel';
import { Header } from './Header';
import styles from './Layout.module.css';

const PLACEHOLDER_CARDS = 12;

export function Layout() {
  const { t } = useI18n();
  return (
    <>
      <a href="#main" className="skip-link">
        {t('app.skipToContent')}
      </a>
      <Header />
      <div className={styles.columns}>
        <main id="main" tabIndex={-1} className={styles.main}>
          <h1 className={styles.heading}>{t('catalog.title')}</h1>
          {/* Catalog: phase 2. */}
          <div className={styles.grid} role="status" aria-busy="true" aria-label={t('catalog.loading')}>
            {Array.from({ length: PLACEHOLDER_CARDS }, (_, i) => (
              <div key={i} className={styles.card}>
                <Skeleton className={styles.thumb} blockSize="auto" />
                <Skeleton inlineSize="80%" />
                <Skeleton inlineSize="50%" blockSize="0.75rem" />
              </div>
            ))}
          </div>
        </main>
        <FeedPanel />
      </div>
    </>
  );
}
