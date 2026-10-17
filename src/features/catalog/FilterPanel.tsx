import { useId, useState } from 'react';
import { useI18n } from '../../i18n/LocaleProvider';
import { CheckIcon, ChevronUpIcon } from '../../shared/icons';
import { Select } from '../../shared/Select';
import { Skeleton } from '../../shared/Skeleton';
import { CATEGORIES, SORTS, activeFilterCount, type Filters, type Sort } from './filters';
import { labelFor, type ProviderOption } from './labels';
import { MAX_QUERY_LENGTH } from './urlState';
import type { FiltersPatch } from './useCatalogFilters';
import styles from './FilterPanel.module.css';

interface Props {
  filters: Filters;
  query: string;
  setQuery: (value: string) => void;
  update: (patch: FiltersPatch) => void;
  /** `null` while the catalog is loading; empty after an error. */
  providers: readonly ProviderOption[] | null;
  tags: readonly string[] | null;
}

interface ChipProps {
  pressed: boolean;
  onClick: () => void;
  children: string;
}

function Chip({ pressed, onClick, children }: ChipProps) {
  return (
    <button type="button" className={styles.chip} aria-pressed={pressed} onClick={onClick}>
      {pressed && <CheckIcon />}
      <span className={styles.chipText}>{children}</span>
    </button>
  );
}

function ChipsSkeleton() {
  return (
    <span className={styles.chips}>
      {[5, 7, 6, 8].map((w, i) => (
        <Skeleton key={i} inlineSize={`${w}rem`} blockSize="2.25rem" className={styles.chipSkeleton} />
      ))}
    </span>
  );
}

export function FilterPanel({ filters, query, setQuery, update, providers, tags }: Props) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const searchId = useId();
  const sortId = useId();
  const panelId = useId();
  const active = activeFilterCount(filters);

  const toggleProvider = (slug: string, checked: boolean) => {
    update({ prov: checked ? [...filters.prov, slug] : filters.prov.filter((p) => p !== slug) });
  };

  return (
    <div className={styles.filters}>
      <div className={styles.toolbar}>
        <div className={styles.search} role="search">
          <label htmlFor={searchId} className="visually-hidden">
            {t('catalog.search.label')}
          </label>
          <input
            id={searchId}
            type="search"
            className={styles.input}
            value={query}
            placeholder={t('catalog.search.placeholder')}
            maxLength={MAX_QUERY_LENGTH}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
        </div>
        <div className={styles.sort}>
          <label htmlFor={sortId} className={styles.sortLabel}>
            {t('catalog.sort.label')}
          </label>
          <Select
            id={sortId}
            className={styles.select}
            value={filters.sort}
            onChange={(e) => {
              const sort = SORTS.find((s) => s === e.target.value);
              if (sort) update({ sort });
            }}
          >
            {SORTS.map((sort: Sort) => (
              <option key={sort} value={sort}>
                {t(`catalog.sort.${sort}`)}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen((v) => !v);
          }}
        >
          <span>{active > 0 ? t('catalog.filters.toggleActive', { count: active }) : t('catalog.filters.toggle')}</span>
          <ChevronUpIcon />
        </button>
      </div>

      <div id={panelId} className={styles.panel} data-open={open}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('catalog.filters.category')}</legend>
          <span className={styles.chips}>
            <Chip
              pressed={filters.cat === null}
              onClick={() => {
                update({ cat: null });
              }}
            >
              {t('catalog.filters.all')}
            </Chip>
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                pressed={filters.cat === cat}
                onClick={() => {
                  update({ cat });
                }}
              >
                {t(`catalog.category.${cat}`)}
              </Chip>
            ))}
          </span>
        </fieldset>

        {providers?.length !== 0 && (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('catalog.filters.provider')}</legend>
            {providers === null ? (
              <ChipsSkeleton />
            ) : (
              <span className={styles.chips}>
                {providers.map(({ slug, name }) => (
                  <label key={slug} className={styles.check}>
                    <input
                      type="checkbox"
                      checked={filters.prov.includes(slug)}
                      onChange={(e) => {
                        toggleProvider(slug, e.target.checked);
                      }}
                    />
                    <span className={styles.chipText}>{name}</span>
                  </label>
                ))}
              </span>
            )}
          </fieldset>
        )}

        {tags?.length !== 0 && (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('catalog.filters.tag')}</legend>
            {tags === null ? (
              <ChipsSkeleton />
            ) : (
              <span className={styles.chips}>
                <Chip
                  pressed={filters.tag === null}
                  onClick={() => {
                    update({ tag: null });
                  }}
                >
                  {t('catalog.filters.all')}
                </Chip>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    pressed={filters.tag === tag}
                    onClick={() => {
                      update({ tag });
                    }}
                  >
                    {labelFor(locale.messages.catalog.tag, tag)}
                  </Chip>
                ))}
              </span>
            )}
          </fieldset>
        )}
      </div>
    </div>
  );
}
