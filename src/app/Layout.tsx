import { Catalog } from '../features/catalog/Catalog';
import { Promos } from '../features/promos/Promos';
import { useI18n } from '../i18n/LocaleProvider';
import { FeedPanel } from './FeedPanel';
import { Header } from './Header';
import styles from './Layout.module.css';

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
          <Catalog promos={<Promos />} />
        </main>
        <FeedPanel />
      </div>
    </>
  );
}
