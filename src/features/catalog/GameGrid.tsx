import { memo } from 'react';
import { useI18n } from '../../i18n/LocaleProvider';
import { Skeleton } from '../../shared/Skeleton';
import { GameCard } from './GameCard';
import type { Game } from './types';
import styles from './GameGrid.module.css';

const PLACEHOLDER_CARDS = 12;

/** Re-renders only when the selected list changes; cards skip unless their game object changes. */
export const GameGrid = memo(function GameGrid({ games }: { games: readonly Game[] }) {
  return (
    // Explicit role: list-style: none drops list semantics in Safari.
    // eslint-disable-next-line jsx-a11y/no-redundant-roles
    <ul className={styles.grid} role="list">
      {games.map((game) => (
        <li key={game.id} className={styles.item}>
          <GameCard game={game} />
        </li>
      ))}
    </ul>
  );
});

export function GameGridSkeleton() {
  const { t } = useI18n();
  return (
    <div className={styles.grid} aria-busy="true">
      <span className="visually-hidden">{t('catalog.loading')}</span>
      {Array.from({ length: PLACEHOLDER_CARDS }, (_, i) => (
        <div key={i} className={styles.placeholder}>
          <Skeleton className={styles.placeholderThumb} blockSize="auto" />
          <Skeleton inlineSize="80%" />
          <Skeleton inlineSize="50%" blockSize="0.75rem" />
          <Skeleton inlineSize="65%" blockSize="0.75rem" />
        </div>
      ))}
    </div>
  );
}
