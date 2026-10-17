import { memo, useCallback, useId, useRef, type CSSProperties, type MouseEvent } from 'react';
import { useI18n } from '../../i18n/LocaleProvider';
import { ArrowForwardIcon, ChevronBackIcon, ChevronForwardIcon } from '../../shared/icons';
import { Skeleton } from '../../shared/Skeleton';
import type { Filters } from '../catalog/filters';
import { useCatalogContext } from '../catalog/CatalogProvider';
import { promoTarget, type Promo } from './promos';
import type { ScrollDirection } from './scroller';
import { usePromoScroller } from './usePromoScroller';
import { usePromos } from './usePromos';
import styles from './Promos.module.css';

const PLACEHOLDER_CARDS = 3;

/** Only a plain primary click becomes in-app navigation; modified clicks keep the browser's behavior. */
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.currentTarget.target === ''
  );
}

const PromoCard = memo(function PromoCard({ promo, onOpen }: { promo: Promo; onOpen: (target: Filters) => void }) {
  const { t } = useI18n();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = promoTarget(promo.filters);
    if (!target || !isPlainClick(event)) return;
    event.preventDefault();
    onOpen(target);
  };
  return (
    <a
      className={styles.card}
      href={`${import.meta.env.BASE_URL}?${promo.filters}`}
      style={{ '--promo-hue': promo.hue } as CSSProperties}
      onClick={onClick}
    >
      <span className={styles.title}>{t(`promos.items.${promo.id}.title`)}</span>
      <span className={styles.body}>{t(`promos.items.${promo.id}.body`)}</span>
      <span className={styles.cta}>
        {t(`promos.items.${promo.id}.cta`)}
        <ArrowForwardIcon className={styles.arrow} width={18} height={18} />
      </span>
    </a>
  );
});

function PromosSkeleton() {
  const { t } = useI18n();
  return (
    <div className={`${styles.track} ${styles.skeletonTrack}`} aria-busy="true">
      <span className="visually-hidden">{t('promos.loading')}</span>
      {Array.from({ length: PLACEHOLDER_CARDS }, (_, i) => (
        <div key={i} className={styles.placeholder}>
          <Skeleton inlineSize="60%" blockSize="1.25rem" />
          <Skeleton inlineSize="90%" blockSize="0.875rem" />
          <Skeleton inlineSize="70%" blockSize="0.875rem" />
          <Skeleton className={styles.placeholderCta} inlineSize="40%" />
        </div>
      ))}
    </div>
  );
}

/** Promotions: a native horizontal scroll container (momentum and snapping come from the browser). */
export function Promos() {
  const { t } = useI18n();
  const { showPromo } = useCatalogContext();
  const promos = usePromos();
  const headingId = useId();
  const listId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { setTrack, controls: scrollable, atStart, atEnd, scroll } = usePromoScroller();
  const ready = promos.status === 'ready' && promos.promos.length > 0;
  const controls = ready && scrollable;

  // aria-disabled, not disabled: a disabled button would drop focus to body at the edge.
  const onScroll = useCallback(
    (direction: ScrollDirection) => {
      if (direction === 'prev' ? atStart : atEnd) return;
      scroll(direction);
    },
    [atStart, atEnd, scroll],
  );

  // The Retry button disappears with the state; keep focus on a stable element.
  const { retry } = promos;
  const onRetry = useCallback(() => {
    retry();
    headingRef.current?.focus();
  }, [retry]);

  return (
    <section className={styles.promos} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
          {t('promos.title')}
        </h2>
        {controls && (
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.control}
              aria-label={t('promos.previous')}
              aria-controls={listId}
              aria-disabled={atStart || undefined}
              onClick={() => {
                onScroll('prev');
              }}
            >
              <ChevronBackIcon className={styles.chevron} />
            </button>
            <button
              type="button"
              className={styles.control}
              aria-label={t('promos.next')}
              aria-controls={listId}
              aria-disabled={atEnd || undefined}
              onClick={() => {
                onScroll('next');
              }}
            >
              <ChevronForwardIcon className={styles.chevron} />
            </button>
          </div>
        )}
      </div>

      {promos.status === 'loading' && <PromosSkeleton />}

      {promos.status === 'error' && (
        <div role="alert" className={styles.state}>
          <div className={styles.stateText}>
            <h3 className={styles.stateTitle}>{t('promos.error.title')}</h3>
            <p>{t('promos.error.body')}</p>
          </div>
          <button type="button" className={styles.action} onClick={onRetry}>
            {t('promos.retry')}
          </button>
        </div>
      )}

      {promos.status === 'ready' && promos.promos.length === 0 && (
        <div className={styles.state}>
          <div className={styles.stateText}>
            <h3 className={styles.stateTitle}>{t('promos.empty.title')}</h3>
            <p>{t('promos.empty.body')}</p>
          </div>
          <button type="button" className={styles.action} onClick={onRetry}>
            {t('promos.retry')}
          </button>
        </div>
      )}

      {ready && (
        // Explicit role: list-style: none drops list semantics in Safari.
        // eslint-disable-next-line jsx-a11y/no-redundant-roles
        <ul
          ref={setTrack}
          id={listId}
          className={controls ? `${styles.track} ${styles.withControls}` : styles.track}
          role="list"
          aria-label={t('promos.list')}
        >
          {promos.promos.map((promo) => (
            <li key={promo.id} className={styles.item}>
              <PromoCard promo={promo} onOpen={showPromo} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
