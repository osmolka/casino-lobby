import type { Game } from '../catalog/types';
import { DEFAULT_LIMIT, rankItems, type Ranked } from './fuzzy';

export type PaletteItem =
  | { kind: 'action'; id: string; label: string }
  | { kind: 'game'; id: string; label: string; game: Game }
  | { kind: 'provider'; id: string; label: string; count: number };

export type PaletteKind = PaletteItem['kind'];

export interface PaletteSources {
  actions: readonly PaletteItem[];
  /** In Trending order: the empty query shows the first few, and rank ties keep this order. */
  games: readonly PaletteItem[];
  providers: readonly PaletteItem[];
}

export interface ResultGroup {
  kind: PaletteKind;
  items: Ranked<PaletteItem>[];
}

export interface Results {
  groups: ResultGroup[];
  /** Items in displayed order: the keyboard order. */
  flat: Ranked<PaletteItem>[];
}

/** Fixed for every query, including the empty one, so groups never jump while typing. */
export const GROUP_ORDER: readonly PaletteKind[] = ['action', 'game', 'provider'];
export const EMPTY_QUERY_GAMES = 5;
/** Small: breaks ties within a tier, never crosses tiers (tiers are 1000 apart). */
const ACTION_BONUS = 5;

/** Empty query: all actions, the first Trending games, then providers. Otherwise the best matches. Max 10. */
export function buildResults(query: string, sources: PaletteSources): Results {
  const empty = query.trim() === '';
  const candidates = empty
    ? [...sources.actions, ...sources.games.slice(0, EMPTY_QUERY_GAMES), ...sources.providers]
    : [...sources.actions, ...sources.games, ...sources.providers];
  const ranked = rankItems(candidates, query, {
    text: (item) => item.label,
    bonus: (item) => (item.kind === 'action' ? ACTION_BONUS : 0),
    limit: DEFAULT_LIMIT,
  });
  const groups = GROUP_ORDER.map((kind) => ({ kind, items: ranked.filter((r) => r.item.kind === kind) })).filter(
    (g) => g.items.length > 0,
  );
  return { groups, flat: groups.flatMap((g) => g.items) };
}
