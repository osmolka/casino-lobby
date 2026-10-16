import type { Category, Game } from './types';

export const CATEGORIES: readonly Category[] = ['slots', 'table', 'live'];
export const SORTS = ['trending', 'new', 'rtp'] as const;
export type Sort = (typeof SORTS)[number];

/** `null` means "all". `prov` is kept deduplicated and sorted (see normalizeFilters). */
export interface Filters {
  cat: Category | null;
  prov: readonly string[];
  tag: string | null;
  q: string;
  sort: Sort;
}

export const DEFAULT_FILTERS: Filters = { cat: null, prov: [], tag: null, q: '', sort: 'trending' };

export function filterGames(games: readonly Game[], f: Filters): Game[] {
  const needle = f.q.trim().toLowerCase();
  const providers = f.prov.length > 0 ? new Set(f.prov) : null;
  return games.filter(
    (g) =>
      (f.cat === null || g.category === f.cat) &&
      (providers === null || providers.has(g.provider)) &&
      (f.tag === null || g.tags.includes(f.tag)) &&
      (needle === '' ||
        g.title.toLowerCase().includes(needle) ||
        g.providerName.toLowerCase().includes(needle)),
  );
}

// Fixed locale: the order must not change with the UI language.
const collator = new Intl.Collator('en', { sensitivity: 'base' });

const primary: Record<Sort, (a: Game, b: Game) => number> = {
  trending: (a, b) => b.popularity - a.popularity,
  new: (a, b) => Date.parse(b.releasedAt) - Date.parse(a.releasedAt),
  rtp: (a, b) => b.rtp - a.rtp,
};

/** Returns a new array; ties are broken by title, then id, so the order is deterministic. */
export function sortGames(games: readonly Game[], sort: Sort): Game[] {
  const compare = primary[sort];
  return [...games].sort(
    (a, b) => compare(a, b) || collator.compare(a.title, b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export function selectGames(games: readonly Game[], f: Filters): Game[] {
  return sortGames(filterGames(games, f), f.sort);
}
