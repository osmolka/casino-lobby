import { useId, useState } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import { ChevronUpIcon } from '../shared/icons';
import { Skeleton } from '../shared/Skeleton';
import styles from './FeedPanel.module.css';

const PLACEHOLDER_ROWS = 6;

/** Side panel on wide screens; a collapsible bar pinned to the bottom on mobile. Feed content: phase 4. */
export function FeedPanel() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const bodyId = useId();

  return (
    <aside className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
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
      <div
        id={bodyId}
        className={styles.body}
        data-open={open}
        role="status"
        aria-busy="true"
        aria-label={t('feed.loading')}
      >
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
    </aside>
  );
}
