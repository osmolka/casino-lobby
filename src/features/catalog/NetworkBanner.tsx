import { useMemo } from 'react';
import { useI18n } from '../../i18n/LocaleProvider';
import { formatSavedAt } from '../../shared/format';
import { useFocusFallback } from '../../shared/useFocusFallback';
import { useOnline } from '../../shared/useOnline';
import type { CatalogState } from './useCatalog';
import styles from './Catalog.module.css';

interface RetryProps {
  className?: string | undefined;
  onClick: () => void;
  /** Where focus goes if this button disappears while focused (an automatic reload after `online`). */
  fallback: () => HTMLElement | null;
}

export function RetryButton({ className, onClick, fallback }: RetryProps) {
  const { t } = useI18n();
  const ref = useFocusFallback<HTMLButtonElement>(fallback);
  return (
    <button ref={ref} type="button" className={className} onClick={onClick}>
      {t('catalog.retry')}
    </button>
  );
}

interface Props {
  catalog: CatalogState;
  onRetry: () => void;
  fallback: () => HTMLElement | null;
}

/**
 * The one place that reports connectivity (H2), worded by cause: offline, or online with a failed refresh.
 * The status element is always in the DOM, so a change is announced; with nothing visible to say it is
 * visually hidden and takes no grid row.
 */
export function NetworkBanner({ catalog, onRetry, fallback }: Props) {
  const { t, locale } = useI18n();
  const { code } = locale;
  const online = useOnline();
  const savedAt = catalog.status === 'ready' ? catalog.savedAt : null;
  const restored = catalog.status === 'ready' && catalog.restored;
  const checkedAt = catalog.status === 'ready' ? catalog.checkedAt : 0;

  // "Today" is judged when the saved catalog was served, not on every render.
  const time = useMemo(() => (savedAt === null ? '' : formatSavedAt(savedAt, checkedAt, code)), [savedAt, checkedAt, code]);

  let message = '';
  if (savedAt !== null) message = t(online ? 'catalog.network.staleSaved' : 'catalog.network.offlineSaved', { time });
  else if (!online) message = t('catalog.network.offline');

  return (
    <div className={message ? styles.banner : styles.bannerIdle}>
      <p role="status" className={message ? styles.bannerText : 'visually-hidden'}>
        {message || (restored ? t('catalog.network.loaded') : '')}
      </p>
      {savedAt !== null && <RetryButton className={styles.bannerRetry} onClick={onRetry} fallback={fallback} />}
    </div>
  );
}
