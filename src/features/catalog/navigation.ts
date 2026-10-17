import { DEFAULT_FILTERS, selectGames, type Filters } from './filters';
import { normalizeFilters } from './urlState';
import type { Game } from './types';

/**
 * Filters that show `game` (command palette → game). Null when it is already in the current results.
 * Otherwise defaults + q = its title, keeping the current sort: any other filter could still hide it.
 */
export function filtersToReveal(current: Filters, games: readonly Game[], game: Game): Filters | null {
  if (selectGames(games, current).some((g) => g.id === game.id)) return null;
  return normalizeFilters({ ...DEFAULT_FILTERS, q: game.title, sort: current.sort });
}

/** Command palette → provider: defaults + only this provider, keeping the current sort. */
export function filtersForProvider(current: Filters, slug: string): Filters {
  return { ...DEFAULT_FILTERS, prov: [slug], sort: current.sort };
}
