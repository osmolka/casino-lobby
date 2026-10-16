import { memo } from 'react';
import { useI18n } from '../../i18n/LocaleProvider';
import { formatMoneyRange, formatPercent } from '../../shared/format';
import { GameThumb } from './GameThumb';
import { labelFor } from './labels';
import type { Game } from './types';
import styles from './GameCard.module.css';

/** Bets are shown in the wallet currency. */
export const BET_CURRENCY = 'EUR';

/**
 * A link to `#game-<id>` (there is no game page); the card is its own :target.
 * Name = title + provider; tags, RTP and bets are the description.
 */
export const GameCard = memo(function GameCard({ game }: { game: Game }) {
  const { t, locale } = useI18n();
  const base = `game-${game.id}`;
  return (
    <a
      id={base}
      href={`#${base}`}
      className={styles.card}
      aria-labelledby={`${base}-title ${base}-provider`}
      aria-describedby={`${base}-details`}
    >
      <GameThumb id={game.id} hue={game.hue} />
      <span className={styles.body}>
        <span id={`${base}-title`} className={styles.title}>
          {game.title}
        </span>
        <span id={`${base}-provider`} className={styles.provider}>
          {game.providerName}
        </span>
        <span id={`${base}-details`} className={styles.details}>
          {game.tags.length > 0 && (
            <span className={styles.tags}>
              {game.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {labelFor(locale.messages.catalog.tag, tag)}
                </span>
              ))}
            </span>
          )}
          <span className={styles.meta}>
            <span>
              {t('catalog.card.rtp')} <bdi className={styles.value}>{formatPercent(game.rtp, locale.code)}</bdi>
            </span>
            <span>
              {t('catalog.card.bet')}{' '}
              <bdi className={styles.value}>
                {formatMoneyRange(game.minBet, game.maxBet, BET_CURRENCY, locale.code)}
              </bdi>
            </span>
          </span>
        </span>
      </span>
    </a>
  );
});
