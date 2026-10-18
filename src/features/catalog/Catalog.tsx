import { useCallback, useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { useI18n } from '../../i18n/LocaleProvider';
import { prefersReducedMotion } from '../../shared/useReducedMotion';
import { CATALOG_ERROR_KEYS } from './api';
import { useCatalogContext } from './CatalogProvider';
import { DEFAULT_FILTERS, selectGames } from './filters';
import { FilterPanel } from './FilterPanel';
import { GameGrid, GameGridSkeleton } from './GameGrid';
import { NetworkBanner, RetryButton } from './NetworkBanner';
import { providerOptions, tagOptions } from './labels';
import { filtersEqual } from './urlState';
import styles from './Catalog.module.css';

interface Props {
  /**
   * Rendered right after the h1 (heading order: h1 → promos h2). Pass an element created by the parent, so a
   * catalog re-render reuses it as is and the slot's own state never re-renders the catalog.
   */
  promos?: ReactNode;
}

export function Catalog({ promos }: Props) {
  const { t } = useI18n();
  const { catalog, filters: catalogFilters, focus, focusDone } = useCatalogContext();
  const { filters, query, setQuery, update, reset } = catalogFilters;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  const games = catalog.status === 'ready' ? catalog.games : null;
  const failed = catalog.status === 'error';

  const selected = useMemo(() => (games ? selectGames(games, filters) : []), [games, filters]);
  const providers = useMemo(() => (games ? providerOptions(games) : failed ? [] : null), [games, failed]);
  const tags = useMemo(() => (games ? tagOptions(games) : failed ? [] : null), [games, failed]);
  const isDefault = filtersEqual(filters, DEFAULT_FILTERS) && query === '';

  // Focus requested by the command palette. Runs after this render's results are in the DOM, and after
  // the palette dialog has returned focus to its trigger (effect cleanups run before effects in a commit).
  useEffect(() => {
    if (!focus) return;
    const target = focus.target === 'heading' ? headingRef.current : document.getElementById(`game-${focus.id}`);
    if (!target) return; // not rendered yet (catalog still loading): retried on the next render
    target.focus({ preventScroll: true });
    // block 'start' honors the card's scroll-margin-block-start (sticky header).
    target.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    focusDone();
  }, [focus, selected, focusDone]);

  // The triggering button disappears after these actions; keep focus on a stable element.
  const { retry } = catalog;
  const onRetry = useCallback(() => {
    retry();
    headingRef.current?.focus();
  }, [retry]);
  const onClear = useCallback(() => {
    reset();
    headingRef.current?.focus();
  }, [reset]);
  // A Retry removed by an automatic reload (`online`) hands focus to the heading, never to body.
  const heading = useCallback(() => headingRef.current, []);

  return (
    <section className={styles.catalog} aria-labelledby={headingId}>
      <h1 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
        {t('catalog.title')}
      </h1>

      <NetworkBanner catalog={catalog} onRetry={retry} fallback={heading} />

      {promos}

      <FilterPanel
        filters={filters}
        query={query}
        setQuery={setQuery}
        update={update}
        providers={providers}
        tags={tags}
      />

      <div className={styles.results}>
        <p role="status" aria-live="polite" className={styles.count}>
          {games ? t('catalog.count', { count: selected.length }) : ''}
        </p>
        {!isDefault && (
          <button type="button" className={styles.clear} onClick={onClear}>
            {t('catalog.filters.clear')}
          </button>
        )}
      </div>

      {catalog.status === 'loading' && <GameGridSkeleton />}

      {catalog.status === 'error' && (
        <div role="alert" className={styles.state}>
          <h2 className={styles.stateTitle}>{t('catalog.error.title')}</h2>
          <p>{t(CATALOG_ERROR_KEYS[catalog.kind])}</p>
          <RetryButton className={styles.action} onClick={onRetry} fallback={heading} />
        </div>
      )}

      {games && selected.length === 0 && (
        <div className={styles.state}>
          <h2 className={styles.stateTitle}>{t('catalog.empty.title')}</h2>
          <p>{t('catalog.empty.body')}</p>
          {isDefault ? (
            <button type="button" className={styles.action} onClick={onRetry}>
              {t('catalog.retry')}
            </button>
          ) : (
            <button type="button" className={styles.action} onClick={onClear}>
              {t('catalog.filters.clear')}
            </button>
          )}
        </div>
      )}

      {games && selected.length > 0 && <GameGrid games={selected} />}
    </section>
  );
}
