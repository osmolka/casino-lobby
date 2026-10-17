import { describe, expect, it } from 'vitest';
import gamesJson from '../../../public/api/games.json?raw';
import promosJson from '../../../public/api/promos.json?raw';
import { DEFAULT_FILTERS, selectGames, type Filters } from '../catalog/filters';
import { filtersForPromo } from '../catalog/navigation';
import type { Game } from '../catalog/types';
import { sanitizeFilters } from '../catalog/urlState';
import { PROMO_IDS, parsePromos, promoTarget } from './promos';

const games = JSON.parse(gamesJson) as Game[];

describe('promoTarget', () => {
  it('parses canonical filter params', () => {
    expect(promoTarget('cat=live')).toEqual({ ...DEFAULT_FILTERS, cat: 'live' });
    expect(promoTarget('cat=slots&tag=megaways')).toEqual({ ...DEFAULT_FILTERS, cat: 'slots', tag: 'megaways' });
    expect(promoTarget('prov=ember-games,pixel-oak&q=book')).toEqual({
      ...DEFAULT_FILTERS,
      prov: ['ember-games', 'pixel-oak'],
      q: 'book',
    });
  });

  it('rejects a non-canonical form (order, leading "?", unknown values, unencoded or duplicate params)', () => {
    expect(promoTarget('tag=megaways&cat=slots')).toBeNull();
    expect(promoTarget('?cat=live')).toBeNull();
    expect(promoTarget('cat=casino')).toBeNull();
    expect(promoTarget('prov=pixel-oak,ember-games')).toBeNull();
    expect(promoTarget('q=book of')).toBeNull();
    expect(promoTarget('cat=live&cat=live')).toBeNull();
    expect(promoTarget('cat=live&mock=slow')).toBeNull();
  });

  it('rejects the default view and any sort (a promo click keeps the current sort)', () => {
    expect(promoTarget('')).toBeNull();
    expect(promoTarget('sort=rtp')).toBeNull();
    expect(promoTarget('cat=live&sort=new')).toBeNull();
  });
});

describe('parsePromos', () => {
  const valid = { id: 'liveWeek', hue: 350, filters: 'cat=live' };

  it('returns valid promos in input order', () => {
    const second = { id: 'megaways', hue: 0, filters: 'cat=slots&tag=megaways' };
    expect(parsePromos([valid, second])).toEqual([valid, second]);
  });

  it('accepts an empty list', () => {
    expect(parsePromos([])).toEqual([]);
  });

  it('is null for a bad shape: not an array, non-object item, wrong field types, hue outside 0–359', () => {
    expect(parsePromos({ promos: [] })).toBeNull();
    expect(parsePromos([null])).toBeNull();
    expect(parsePromos(['liveWeek'])).toBeNull();
    expect(parsePromos([{ ...valid, id: 1 }])).toBeNull();
    expect(parsePromos([{ ...valid, filters: null }])).toBeNull();
    expect(parsePromos([{ ...valid, hue: '350' }])).toBeNull();
    expect(parsePromos([{ ...valid, hue: 360 }])).toBeNull();
    expect(parsePromos([{ ...valid, hue: -1 }])).toBeNull();
    expect(parsePromos([{ ...valid, hue: 1.5 }])).toBeNull();
  });

  it('drops promos the client has no copy for, a broken target and repeated ids', () => {
    expect(
      parsePromos([
        { id: 'summerSplash', hue: 10, filters: 'cat=live' },
        { id: 'toString', hue: 10, filters: 'cat=live' },
        { id: 'jackpotHunt', hue: 10, filters: 'tag=jackpot&cat=slots' },
        valid,
        { ...valid, hue: 20 },
      ]),
    ).toEqual([valid]);
  });
});

describe('promos.json fixture', () => {
  const promos = parsePromos(JSON.parse(promosJson)) ?? [];

  it('is valid and has one promo per id in en.promos.items', () => {
    expect(promos.map((p) => p.id).sort()).toEqual([...PROMO_IDS].sort());
  });

  it.each(PROMO_IDS)('%s leads to a non-empty catalog view that sanitize keeps as is, from any current view', (id) => {
    const promo = promos.find((p) => p.id === id);
    const target = promo ? promoTarget(promo.filters) : null;
    expect(target).not.toBeNull();
    if (!target) return;
    expect(sanitizeFilters(target, games)).toBe(target);
    const views: Filters[] = [
      DEFAULT_FILTERS,
      { cat: 'table', prov: ['northlight'], tag: 'classic', q: 'zzz', sort: 'rtp' },
    ];
    for (const view of views) {
      expect(selectGames(games, filtersForPromo(view, target)).length).toBeGreaterThan(0);
    }
  });
});

describe('filtersForPromo', () => {
  it('is defaults + the promo target, keeping only the current sort', () => {
    const target = { ...DEFAULT_FILTERS, cat: 'live' as const };
    const current: Filters = { cat: 'slots', prov: ['northlight'], tag: 'new', q: 'x', sort: 'new' };
    expect(filtersForPromo(current, target)).toEqual({ ...DEFAULT_FILTERS, cat: 'live', sort: 'new' });
  });
});
