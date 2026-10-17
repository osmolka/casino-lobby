import { describe, expect, it } from 'vitest';
import { makeGame } from '../catalog/testGames';
import { EMPTY_QUERY_GAMES, GROUP_ORDER, buildResults, type PaletteItem, type PaletteSources } from './results';

const action = (id: string, label: string): PaletteItem => ({ kind: 'action', id, label });
const game = (id: string, title: string): PaletteItem => ({ kind: 'game', id, label: title, game: makeGame({ id, title }) });
const provider = (slug: string, name: string): PaletteItem => ({ kind: 'provider', id: slug, label: name, count: 3 });

// Games are passed in Trending order.
const sources: PaletteSources = {
  actions: [action('theme', 'Switch to dark theme'), action('deposit', 'Make a deposit'), action('clear', 'Clear filters')],
  games: [
    game('g1', 'Neon Treasure'),
    game('g2', 'Turbo Baccarat'),
    game('g3', 'Classic Three Card Poker'),
    game('g4', 'Immersive Blackjack'),
    game('g5', 'Cosmic Quest'),
    game('g6', 'Thunder Riches'),
    game('g7', 'Frozen Vault XL'),
    game('g8', 'Dark Riches'),
  ],
  providers: [provider('aurora', 'Aurora Studios'), provider('blackfin', 'Blackfin Gaming'), provider('ember', 'Ember Games'), provider('red', 'Red Lantern')],
};

const labels = (query: string) => buildResults(query, sources).flat.map((r) => r.item.label);
const kinds = (query: string) => buildResults(query, sources).groups.map((g) => g.kind);

describe('buildResults', () => {
  it('empty query: all actions, then the first Trending games, then providers; 10 at most', () => {
    const { flat, groups } = buildResults('', sources);
    expect(groups.map((g) => g.kind)).toEqual(['action', 'game', 'provider']);
    expect(flat).toHaveLength(10);
    expect(labels('')).toEqual([
      'Switch to dark theme',
      'Make a deposit',
      'Clear filters',
      ...sources.games.slice(0, EMPTY_QUERY_GAMES).map((g) => g.label),
      ...sources.providers.slice(0, 10 - 3 - EMPTY_QUERY_GAMES).map((p) => p.label),
    ]);
    expect(flat.every((r) => r.matches.length === 0)).toBe(true);
  });

  it('a query: the 10 best by rank, displayed in the fixed group order actions → games → providers', () => {
    const { groups, flat } = buildResults('r', sources);
    expect(flat.length).toBeLessThanOrEqual(10);
    expect(groups.map((g) => g.kind)).toEqual(GROUP_ORDER.filter((k) => groups.some((g) => g.kind === k)));
  });

  it('flat order (keyboard order) equals the displayed order across groups', () => {
    const { groups, flat } = buildResults('ar', sources);
    expect(flat).toEqual(groups.flatMap((g) => g.items));
  });

  it('group order does not jump while typing', () => {
    for (const query of ['d', 'da', 'dar', 'dark']) {
      const order = kinds(query);
      expect(order, query).toEqual(GROUP_ORDER.filter((k) => order.includes(k)));
    }
    expect(kinds('dark')).toEqual(['action', 'game']); // 'Switch to dark theme' and 'Dark Riches'
  });

  it('ranks within a group: the action matched by its name ranks first in its group', () => {
    expect(labels('dark')).toEqual(['Switch to dark theme', 'Dark Riches']);
    expect(labels('frz vlt')).toEqual(['Frozen Vault XL']);
    expect(labels('ember')).toEqual(['Ember Games']);
  });

  it('no match: no groups', () => {
    expect(buildResults('qqqq', sources)).toEqual({ groups: [], flat: [] });
  });

  it('matches translated action labels', () => {
    const ru: PaletteSources = { ...sources, actions: [action('theme', 'Тёмная тема')] };
    expect(buildResults('тем', ru).flat.map((r) => r.item.id)).toEqual(['theme']);
  });
});
