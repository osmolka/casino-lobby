import { memo, useEffect, useState, type CSSProperties } from 'react';
import { useI18n } from '../../i18n/LocaleProvider';
import { formatMoney, formatRelativeTime } from '../../shared/format';
import { WALLET_CURRENCY } from '../wallet/types';
import type { FeedStore } from './feedStore';
import { initials } from './generator';
import type { Win } from './types';
import { useFeedSlice } from './useFeed';
import styles from './Feed.module.css';

/** Relative times refresh on this timer, local to the list (not global state). */
export const TIME_REFRESH_MS = 30_000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

interface RowProps {
  win: Win;
  now: number;
  /** Arrived after the list mounted: animates in. */
  fresh: boolean;
}

const FeedRow = memo(function FeedRow({ win, now, fresh }: RowProps) {
  const { t, rich, locale } = useI18n();
  const amount = formatMoney(win.amount, WALLET_CURRENCY, locale.code);
  const time = formatRelativeTime(win.at, now, locale.code) ?? t('feed.justNow');
  return (
    <li className={styles.row} data-fresh={fresh || undefined}>
      <span className={styles.avatar} style={{ '--hue': win.hue } as CSSProperties} aria-hidden="true">
        {initials(win.player)}
      </span>
      <span className={styles.rowText}>
        <span className={styles.line}>
          {rich('feed.win', { player: <bdi>{win.player}</bdi>, amount: <bdi className={styles.amount}>{amount}</bdi> })}
        </span>
        <span className={styles.meta}>
          {rich('feed.meta', {
            game: <bdi>{win.gameTitle}</bdi>,
            time: <time dateTime={new Date(win.at).toISOString()}>{time}</time>,
          })}
        </span>
      </span>
    </li>
  );
});

/**
 * The wins, newest first. The list itself is the hover/focus pause region; the Pause button lives outside it,
 * so pointing at or focusing the button never pauses the feed. No aria-live: entries are not announced.
 */
export function FeedList({ store }: { store: FeedStore }) {
  const { t } = useI18n();
  const wins = useFeedSlice(store, 'wins');
  const now = useNow(TIME_REFRESH_MS);
  const [mountedAt] = useState(Date.now);

  // The pointer or focus can leave by unmount (retry, state change): never leave a stale pause behind.
  useEffect(
    () => () => {
      store.resume('hover');
      store.resume('focus');
    },
    [store],
  );

  /* eslint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions --
     Focusable scroll region (axe scrollable-region-focusable). Focus and mouse hover only pause the feed;
     they are not actions, and the Pause button is the explicit control. */
  return (
    <ol
      className={styles.list}
      tabIndex={0}
      aria-label={t('feed.list')}
      onPointerEnter={(event) => {
        // Mouse only: a tap on touch fires pointerenter but never a matching hover-out.
        if (event.pointerType === 'mouse') store.pause('hover');
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') store.resume('hover');
      }}
      onFocus={() => {
        store.pause('focus');
      }}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        store.resume('focus');
      }}
    >
      {wins.map((win) => (
        <FeedRow key={win.id} win={win} now={now} fresh={win.at > mountedAt} />
      ))}
    </ol>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */
}
