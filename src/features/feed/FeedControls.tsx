import { useI18n } from '../../i18n/LocaleProvider';
import type { MessageKey } from '../../i18n/types';
import { PauseIcon, PlayIcon } from '../../shared/icons';
import type { FeedStore } from './feedStore';
import type { PauseReason } from './types';
import { useFeedSlice } from './useFeed';
import styles from './Feed.module.css';

function hintKey(reasons: ReadonlySet<PauseReason>): MessageKey | null {
  if (reasons.has('offline')) return 'feed.pausedOffline';
  if (reasons.has('user')) return null; // the button already says Resume
  if (reasons.has('hover') || reasons.has('focus')) return 'feed.pausedReading';
  return null;
}

/** WCAG 2.2.2 pause control. The label changes (Pause/Resume); no aria-pressed on top of that. */
export function FeedControls({ store }: { store: FeedStore }) {
  const { t } = useI18n();
  const reasons = useFeedSlice(store, 'reasons');
  const paused = reasons.has('user');
  const hint = hintKey(reasons);

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.pause}
        onClick={() => {
          if (paused) store.resume('user');
          else store.pause('user');
        }}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
        <span>{t(paused ? 'feed.resume' : 'feed.pause')}</span>
      </button>
      <span className={styles.hint}>{hint ? t(hint) : ''}</span>
    </div>
  );
}
