import { useCallback, useId, useRef, useState } from 'react';
import { FeedControls } from '../features/feed/FeedControls';
import { FeedList } from '../features/feed/FeedList';
import { useFeed } from '../features/feed/useFeed';
import { useI18n } from '../i18n/LocaleProvider';
import { ChevronUpIcon } from '../shared/icons';
import { Skeleton } from '../shared/Skeleton';
import styles from './FeedPanel.module.css';

const PLACEHOLDER_ROWS = 6;

/**
 * Side panel on wide screens; a collapsible bar pinned to the bottom on mobile. Feed state lives in its own
 * store, subscribed only by the list and the controls, so a tick never re-renders anything outside them.
 */
export function FeedPanel() {
  const { t } = useI18n();
  const feed = useFeed();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The Try again button disappears; keep focus on a stable element.
  const { retry } = feed;
  const onRetry = useCallback(() => {
    retry();
    headingRef.current?.focus();
  }, [retry]);

  return (
    <aside className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className={styles.title}>
          {t('feed.title')}
        </h2>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            setOpen((v) => !v);
          }}
        >
          <span>{t(open ? 'feed.hide' : 'feed.show')}</span>
          <ChevronUpIcon />
        </button>
      </div>
      <div id={bodyId} className={styles.body} data-open={open}>
        {feed.status === 'loading' && (
          <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('feed.loading')}>
            {Array.from({ length: PLACEHOLDER_ROWS }, (_, i) => (
              <div key={i} className={styles.row}>
                <Skeleton inlineSize="2.5rem" blockSize="2.5rem" />
                <span className={styles.rowText}>
                  <Skeleton inlineSize="70%" />
                  <Skeleton inlineSize="40%" blockSize="0.75rem" />
                </span>
              </div>
            ))}
          </div>
        )}

        {feed.status === 'error' && (
          <div role="alert" className={styles.state}>
            <h3 className={styles.stateTitle}>{t('feed.error.title')}</h3>
            <p>{t('feed.error.body')}</p>
            <button type="button" className={styles.action} onClick={onRetry}>
              {t('feed.retry')}
            </button>
          </div>
        )}

        {feed.status === 'empty' && (
          <div className={styles.state}>
            <h3 className={styles.stateTitle}>{t('feed.empty.title')}</h3>
            <p>{t('feed.empty.body')}</p>
            <button type="button" className={styles.action} onClick={onRetry}>
              {t('feed.retry')}
            </button>
          </div>
        )}

        {feed.status === 'ready' && (
          <>
            <FeedControls store={feed.store} />
            <FeedList store={feed.store} />
          </>
        )}
      </div>
    </aside>
  );
}
