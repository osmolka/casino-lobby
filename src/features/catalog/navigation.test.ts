import { describe, expect, it } from 'vitest';
import fixtureJson from '../../../public/api/games.json?raw';
import { DEFAULT_FILTERS, selectGames, type Filters } from './filters';
import { filtersForProvider, filtersToReveal } from './navigation';
import { makeGame } from './testGames';
import type { Game } from './types';

const fixture = JSON.parse(fixtureJson) as Game[];

const games = [
  makeGame({ id: 'a', title: 'Book of Embers', provider: 'ember-games', providerName: 'Ember Games', tags: ['bonus-buy'] }),
  makeGame({ id: 'b', title: 'Lightning Roulette', provider: 'silverline-live', providerName: 'Silverline Live', category: 'live' }),
  makeGame({ id: 'c', title: 'Book of Dawn', provider: 'pixel-oak', providerName: 'Pixel Oak', tags: ['megaways'] }),
];
const [book, roulette] = games as [Game, Game, Game];

const narrow: Filters = { cat: 'slots', prov: ['ember-games'], tag: 'bonus-buy', q: 'emb', sort: 'rtp' };

describe('filtersToReveal', () => {
  it('returns null when the game is already in the current results', () => {
    expect(filtersToReveal(DEFAULT_FILTERS, games, book)).toBeNull();
    expect(filtersToReveal(narrow, games, book)).toBeNull();
  });

  it('otherwise: defaults + q = title, keeping only the current sort', () => {
    expect(filtersToReveal(narrow, games, roulette)).toEqual({ ...DEFAULT_FILTERS, q: 'Lightning Roulette', sort: 'rtp' });
  });

  it('every fixture game is in the results after revealing it, from any narrow view', () => {
    const views: Filters[] = [
      { cat: 'table', prov: ['nobody'], tag: 'jackpot', q: 'zzz', sort: 'new' },
      { ...DEFAULT_FILTERS, q: 'zzz' },
    ];
    for (const view of views) {
      for (const game of fixture) {
        const next = filtersToReveal(view, fixture, game) ?? view;
        expect(selectGames(fixture, next).map((g) => g.id), game.title).toContain(game.id);
        expect(next.sort).toBe(view.sort);
      }
    }
  });
});

describe('filtersForProvider', () => {
  it('defaults + prov = [slug], keeping only the current sort', () => {
    expect(filtersForProvider(narrow, 'pixel-oak')).toEqual({ ...DEFAULT_FILTERS, prov: ['pixel-oak'], sort: 'rtp' });
    expect(filtersForProvider(DEFAULT_FILTERS, 'pixel-oak')).toEqual({ ...DEFAULT_FILTERS, prov: ['pixel-oak'] });
  });
});
