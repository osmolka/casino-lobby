import { describe, expect, it } from 'vitest';
import { labelFor, providerOptions, tagOptions } from './labels';
import { makeGame } from './testGames';

describe('labelFor', () => {
  const dict = { jackpot: 'Jackpot', 'bonus-buy': 'Bonus buy' };

  it('returns the dictionary label for a known slug', () => {
    expect(labelFor(dict, 'bonus-buy')).toBe('Bonus buy');
  });

  it('falls back to the slug for an unknown one', () => {
    expect(labelFor(dict, 'cascading')).toBe('cascading');
  });

  it('ignores inherited object keys', () => {
    expect(labelFor(dict, 'toString')).toBe('toString');
  });
});

const games = [
  makeGame({ id: '1', provider: 'red-lantern', providerName: 'Red Lantern', tags: ['jackpot', 'new'] }),
  makeGame({ id: '2', provider: 'aurora-studios', providerName: 'Aurora Studios', tags: ['megaways'] }),
  makeGame({ id: '3', provider: 'red-lantern', providerName: 'Red Lantern', tags: ['jackpot'] }),
  makeGame({ id: '4', provider: 'blackfin-gaming', providerName: 'Blackfin Gaming', tags: [] }),
];

describe('providerOptions', () => {
  it('lists each provider once, sorted by name', () => {
    expect(providerOptions(games)).toEqual([
      { slug: 'aurora-studios', name: 'Aurora Studios' },
      { slug: 'blackfin-gaming', name: 'Blackfin Gaming' },
      { slug: 'red-lantern', name: 'Red Lantern' },
    ]);
  });
});

describe('tagOptions', () => {
  it('lists each tag once, sorted by slug', () => {
    expect(tagOptions(games)).toEqual(['jackpot', 'megaways', 'new']);
  });

  it('returns an empty list for an empty catalog', () => {
    expect(tagOptions([])).toEqual([]);
    expect(providerOptions([])).toEqual([]);
  });
});
