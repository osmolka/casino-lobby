import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Filters } from './filters';
import { filtersForPromo, filtersForProvider, filtersToReveal } from './navigation';
import type { Game } from './types';
import { useCatalog, type CatalogResult } from './useCatalog';
import { useCatalogFilters, type CatalogFilters } from './useCatalogFilters';

/** Where Catalog moves focus after its next render (a new object per request). */
export type CatalogFocus = { target: 'game'; id: string } | { target: 'heading' };

interface CatalogContextValue {
  catalog: CatalogResult;
  filters: CatalogFilters;
  focus: CatalogFocus | null;
  /** Catalog calls this once it has moved focus. */
  focusDone: () => void;
  /** Shows the game's card (changing filters only if it is not in the results) and focuses it. */
  showGame: (game: Game) => void;
  /** Shows only this provider's games and focuses the results heading. */
  showProvider: (slug: string) => void;
  /** Clears every filter and focuses the results heading. */
  clearFilters: () => void;
  /** Promo card: shows the target view (current sort kept) and focuses the results heading. */
  showPromo: (target: Filters) => void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

/**
 * Catalog data and filter state, shared by the catalog and the command palette (one games request).
 * The palette's own state (open, query) stays in the palette, so typing there never re-renders the grid.
 */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog();
  const filters = useCatalogFilters();
  const [focus, setFocus] = useState<CatalogFocus | null>(null);

  const games = catalog.status === 'ready' ? catalog.games : null;
  const { filters: applied, navigate, reset, sanitize } = filters;

  useEffect(() => {
    if (games) sanitize(games);
  }, [games, sanitize]);

  const showGame = useCallback(
    (game: Game) => {
      const next = games ? filtersToReveal(applied, games, game) : null;
      if (next) navigate(next);
      setFocus({ target: 'game', id: game.id });
    },
    [games, applied, navigate],
  );

  const showProvider = useCallback(
    (slug: string) => {
      navigate(filtersForProvider(applied, slug));
      setFocus({ target: 'heading' });
    },
    [applied, navigate],
  );

  const showPromo = useCallback(
    (target: Filters) => {
      navigate(filtersForPromo(applied, target));
      setFocus({ target: 'heading' });
    },
    [applied, navigate],
  );

  const clearFilters = useCallback(() => {
    reset();
    setFocus({ target: 'heading' });
  }, [reset]);

  const focusDone = useCallback(() => {
    setFocus(null);
  }, []);

  const value = useMemo(
    () => ({ catalog, filters, focus, focusDone, showGame, showProvider, clearFilters, showPromo }),
    [catalog, filters, focus, focusDone, showGame, showProvider, clearFilters, showPromo],
  );
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalogContext(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalogContext must be used inside <CatalogProvider>');
  return ctx;
}
