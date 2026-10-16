import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_FILTERS, type Filters } from './filters';
import { buildSearch, filtersEqual, normalizeFilters, parseFilters, sanitizeFilters } from './urlState';
import type { Game } from './types';

export const SEARCH_DEBOUNCE_MS = 250;

type Mode = 'push' | 'replace';
export type FiltersPatch = Partial<Omit<Filters, 'q'>>;

export interface CatalogFilters {
  /** Applied filters (q is debounced). Drive the list from this. */
  filters: Filters;
  /** Raw search input value; updates instantly. */
  query: string;
  setQuery: (value: string) => void;
  /** Discrete change (category, providers, tag, sort): pushState. Flushes a pending query into the same entry. */
  update: (patch: FiltersPatch) => void;
  reset: () => void;
  /** Call once the catalog is loaded: drops unknown providers/tags via replaceState. */
  sanitize: (games: readonly Game[]) => void;
}

/** Writes `f` into the URL, keeping non-filter params (e.g. `mock`). No-op if the URL would not change. */
function writeUrl(f: Filters, mode: Mode): void {
  const { pathname, search, hash } = window.location;
  const next = buildSearch(search, f);
  if (next === search) return;
  const url = `${pathname}${next}${hash}`;
  if (mode === 'push') window.history.pushState(window.history.state, '', url);
  else window.history.replaceState(window.history.state, '', url);
}

export function useCatalogFilters(): CatalogFilters {
  // Lazy init from the URL: the first render already has the right filters (no default-then-restore flash).
  const [state, setState] = useState(() => {
    const filters = parseFilters(window.location.search);
    return { filters, query: filters.q };
  });
  // Refs mirror the latest values for timer and event callbacks; written only outside render.
  const appliedRef = useRef(state.filters);
  const queryRef = useRef(state.query);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const gamesRef = useRef<readonly Game[] | null>(null);

  const cancelPending = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);

  const apply = useCallback((next: Filters, mode: Mode, query?: string) => {
    const changed = !filtersEqual(next, appliedRef.current);
    if (changed) {
      appliedRef.current = next;
      writeUrl(next, mode);
    }
    if (query !== undefined) queryRef.current = query;
    if (changed || query !== undefined) setState({ filters: appliedRef.current, query: queryRef.current });
  }, []);

  const setQuery = useCallback(
    (value: string) => {
      cancelPending();
      queryRef.current = value;
      setState((s) => ({ ...s, query: value }));
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined;
        apply(normalizeFilters({ ...appliedRef.current, q: value }), 'replace');
      }, SEARCH_DEBOUNCE_MS);
    },
    [apply, cancelPending],
  );

  const update = useCallback(
    (patch: FiltersPatch) => {
      cancelPending();
      const base = appliedRef.current;
      const next = normalizeFilters({ ...base, ...patch, q: queryRef.current });
      const discreteChanged = !filtersEqual({ ...next, q: base.q }, base);
      apply(next, discreteChanged ? 'push' : 'replace');
    },
    [apply, cancelPending],
  );

  const reset = useCallback(() => {
    cancelPending();
    apply(DEFAULT_FILTERS, 'push', '');
  }, [apply, cancelPending]);

  const sanitize = useCallback(
    (games: readonly Game[]) => {
      gamesRef.current = games;
      apply(sanitizeFilters(appliedRef.current, games), 'replace');
    },
    [apply],
  );

  useEffect(() => {
    // Canonicalize a hand-written or stale URL without adding a history entry.
    writeUrl(appliedRef.current, 'replace');

    const onPopState = () => {
      cancelPending();
      const parsed = parseFilters(window.location.search);
      const next = gamesRef.current ? sanitizeFilters(parsed, gamesRef.current) : parsed;
      writeUrl(next, 'replace');
      appliedRef.current = next;
      queryRef.current = next.q;
      setState({ filters: next, query: next.q });
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      cancelPending();
    };
  }, [cancelPending]);

  return useMemo(
    () => ({ ...state, setQuery, update, reset, sanitize }),
    [state, setQuery, update, reset, sanitize],
  );
}
