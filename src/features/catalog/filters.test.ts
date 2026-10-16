import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, activeFilterCount, filterGames, selectGames, sortGames, type Filters } from './filters';
import { makeGame } from './testGames';

const games = [
  makeGame({
    id: 'a',
    title: 'Book of Embers',
    provider: 'ember-games',
    providerName: 'Ember Games',
    category: 'slots',
    tags: ['bonus-buy'],
    rtp: 96.5,
    releasedAt: '2026-03-01T00:00:00.000Z',
    popularity: 90,
  }),
  makeGame({
    id: 'b',
    title: 'Aurora Megaways',
    provider: 'aurora-studios',
    providerName: 'Aurora Studios',
    category: 'slots',
    tags: ['megaways', 'jackpot'],
    rtp: 97.1,
    releasedAt: '2026-09-01T00:00:00.000Z',
    popularity: 40,
  }),
  makeGame({
    id: 'c',
    title: 'Blackjack Classic',
    provider: 'pixel-oak',
    providerName: 'Pixel Oak',
    category: 'table',
    tags: ['classic'],
    rtp: 99.5,
    releasedAt: '2025-05-01T00:00:00.000Z',
    popularity: 60,
  }),
  makeGame({
    id: 'd',
    title: 'Live Roulette',
    provider: 'silverline-live',
    providerName: 'Silverline Live',
    category: 'live',
    tags: ['classic'],
    rtp: 97.3,
    releasedAt: '2026-07-01T00:00:00.000Z',
    popularity: 60,
  }),
  makeGame({
    id: 'e',
    title: 'Ember Jackpot Book',
    provider: 'ember-games',
    providerName: 'Ember Games',
    category: 'slots',
    tags: ['jackpot'],
    rtp: 96.5,
    releasedAt: '2026-09-01T00:00:00.000Z',
    popularity: 75,
  }),
];

const ids = (list: readonly { id: string }[]) => list.map((g) => g.id);
const withFilters = (patch: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...patch });

describe('filterGames', () => {
  it('returns every game for default filters', () => {
    expect(ids(filterGames(games, DEFAULT_FILTERS))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('filters by category', () => {
    expect(ids(filterGames(games, withFilters({ cat: 'table' })))).toEqual(['c']);
  });

  it('combines providers with OR', () => {
    const result = filterGames(games, withFilters({ prov: ['pixel-oak', 'silverline-live'] }));
    expect(ids(result)).toEqual(['c', 'd']);
  });

  it('filters by tag', () => {
    expect(ids(filterGames(games, withFilters({ tag: 'jackpot' })))).toEqual(['b', 'e']);
  });

  it('searches title case-insensitively', () => {
    expect(ids(filterGames(games, withFilters({ q: 'BOOK' })))).toEqual(['a', 'e']);
  });

  it('searches by provider name', () => {
    expect(ids(filterGames(games, withFilters({ q: 'pixel oak' })))).toEqual(['c']);
  });

  it('ignores surrounding whitespace in the query', () => {
    expect(ids(filterGames(games, withFilters({ q: '  roulette ' })))).toEqual(['d']);
  });

  it('combines groups with AND', () => {
    const result = filterGames(
      games,
      withFilters({ cat: 'slots', prov: ['ember-games', 'aurora-studios'], tag: 'jackpot', q: 'ember' }),
    );
    expect(ids(result)).toEqual(['e']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterGames(games, withFilters({ cat: 'live', tag: 'megaways' }))).toEqual([]);
  });

  it('returns an empty list for an empty catalog', () => {
    expect(filterGames([], DEFAULT_FILTERS)).toEqual([]);
  });
});

describe('filterGames search tokens', () => {
  const catalog = [
    makeGame({ id: 'dead', title: 'Book of Dead', provider: 'playn-go', providerName: "Play'n GO" }),
    makeGame({ id: 'star', title: 'Starburst', provider: 'netent', providerName: 'NetEnt' }),
    makeGame({ id: 'gonzo', title: "Gonzo's Quest", provider: 'netent', providerName: 'NetEnt' }),
  ];
  const search = (q: string) => ids(filterGames(catalog, withFilters({ q })));

  it('matches when every token is in the title ("book dead")', () => {
    expect(search('book dead')).toEqual(['dead']);
  });

  it('matches tokens across title and provider ("starburst netent")', () => {
    expect(search('starburst netent')).toEqual(['star']);
  });

  it('ignores word order', () => {
    expect(search('dead book')).toEqual(['dead']);
    expect(search('netent starburst')).toEqual(['star']);
  });

  it('ignores extra whitespace between and around tokens', () => {
    expect(search('  book \t  dead  ')).toEqual(['dead']);
  });

  it('requires every token to match', () => {
    expect(search('book netent')).toEqual([]);
  });

  it('matches everything for an empty or whitespace-only query', () => {
    expect(search('')).toEqual(['dead', 'star', 'gonzo']);
    expect(search(' \t ')).toEqual(['dead', 'star', 'gonzo']);
  });
});

describe('sortGames', () => {
  it('sorts trending by popularity descending, ties by title', () => {
    expect(ids(sortGames(games, 'trending'))).toEqual(['a', 'e', 'c', 'd', 'b']);
  });

  it('sorts new by release date descending, ties by title', () => {
    expect(ids(sortGames(games, 'new'))).toEqual(['b', 'e', 'd', 'a', 'c']);
  });

  it('sorts rtp descending, ties by title', () => {
    expect(ids(sortGames(games, 'rtp'))).toEqual(['c', 'd', 'b', 'a', 'e']);
  });

  it('breaks a full tie by id so the order is deterministic', () => {
    const twins = [makeGame({ id: 'z', title: 'Same' }), makeGame({ id: 'y', title: 'Same' })];
    expect(ids(sortGames(twins, 'trending'))).toEqual(['y', 'z']);
  });

  it('does not mutate the input array', () => {
    const input = [...games];
    sortGames(input, 'rtp');
    expect(ids(input)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('selectGames', () => {
  it('filters then sorts', () => {
    const result = selectGames(games, withFilters({ tag: 'classic', sort: 'rtp' }));
    expect(ids(result)).toEqual(['c', 'd']);
  });
});

describe('activeFilterCount', () => {
  it('is 0 for the defaults', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it('counts category, each provider, tag and search; sort is not a filter', () => {
    expect(
      activeFilterCount({ cat: 'slots', prov: ['a', 'b'], tag: 'jackpot', q: 'book', sort: 'rtp' }),
    ).toBe(5);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, sort: 'new' })).toBe(0);
  });
});
