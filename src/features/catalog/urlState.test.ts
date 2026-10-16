import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, type Filters } from './filters';
import {
  MAX_QUERY_LENGTH,
  buildSearch,
  filtersEqual,
  normalizeFilters,
  parseFilters,
  sanitizeFilters,
  serializeFilters,
} from './urlState';
import { makeGame } from './testGames';

const withFilters = (patch: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...patch });

describe('parseFilters', () => {
  it('returns defaults for an empty search', () => {
    expect(parseFilters('')).toEqual(DEFAULT_FILTERS);
    expect(parseFilters('?')).toEqual(DEFAULT_FILTERS);
  });

  it('parses the full schema', () => {
    expect(parseFilters('?cat=slots&prov=netent,pragmatic&tag=jackpot&q=book&sort=rtp')).toEqual({
      cat: 'slots',
      prov: ['netent', 'pragmatic'],
      tag: 'jackpot',
      q: 'book',
      sort: 'rtp',
    });
  });

  it('accepts a search without the leading "?"', () => {
    expect(parseFilters('cat=live').cat).toBe('live');
  });

  it('drops unknown category and sort values', () => {
    expect(parseFilters('?cat=poker&sort=random')).toEqual(DEFAULT_FILTERS);
  });

  it('drops malformed tag and provider slugs, keeps valid ones', () => {
    const f = parseFilters('?tag=<script>&prov=Bad Slug,ok-one,,-dash,two--dashes,fine');
    expect(f.tag).toBeNull();
    expect(f.prov).toEqual(['fine', 'ok-one']);
  });

  it('deduplicates and sorts providers', () => {
    expect(parseFilters('?prov=pixel-oak,ember-games,pixel-oak').prov).toEqual(['ember-games', 'pixel-oak']);
  });

  it('trims q and treats whitespace-only q as default', () => {
    expect(parseFilters('?q=%20%20book%20').q).toBe('book');
    expect(parseFilters('?q=%20%20%20').q).toBe('');
  });

  it('caps q length', () => {
    expect(parseFilters(`?q=${'x'.repeat(MAX_QUERY_LENGTH + 50)}`).q).toHaveLength(MAX_QUERY_LENGTH);
  });

  it('uses the first value of a repeated key', () => {
    expect(parseFilters('?cat=table&cat=live').cat).toBe('table');
  });

  it('ignores mock and unknown params', () => {
    expect(parseFilters('?mock=fail-catalog,slow&utm_source=x')).toEqual(DEFAULT_FILTERS);
  });

  it('does not crash on malformed percent-encoding and yields valid state', () => {
    const f = parseFilters('?q=%E0%A4%A&cat=%E0&prov=%ZZ,ok&sort=%');
    expect(f.cat).toBeNull();
    expect(f.sort).toBe('trending');
    expect(f.prov).toEqual(['ok']);
    expect(typeof f.q).toBe('string');
  });

  it('ignores array-style and empty keys', () => {
    expect(parseFilters('?cat[]=slots&=x&&prov=')).toEqual(DEFAULT_FILTERS);
  });
});

describe('normalizeFilters', () => {
  it('deduplicates and sorts providers, trims q', () => {
    expect(normalizeFilters(withFilters({ prov: ['b', 'a', 'b'], q: '  hi  ' }))).toEqual(
      withFilters({ prov: ['a', 'b'], q: 'hi' }),
    );
  });
});

describe('serializeFilters', () => {
  it('returns an empty string for defaults', () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toBe('');
  });

  it('omits default values', () => {
    expect(serializeFilters(withFilters({ sort: 'trending', q: '   ', tag: 'new' }))).toBe('tag=new');
  });

  it('writes params in canonical order with a literal comma between providers', () => {
    const f: Filters = { sort: 'rtp', q: 'book', tag: 'jackpot', prov: ['pragmatic', 'netent'], cat: 'slots' };
    expect(serializeFilters(f)).toBe('cat=slots&prov=netent,pragmatic&tag=jackpot&q=book&sort=rtp');
  });

  it('encodes special characters in q', () => {
    expect(serializeFilters(withFilters({ q: 'a&b #1 €' }))).toBe('q=a%26b%20%231%20%E2%82%AC');
  });

  it('round-trips through parseFilters', () => {
    const cases: Filters[] = [
      DEFAULT_FILTERS,
      withFilters({ cat: 'live', sort: 'new' }),
      withFilters({ prov: ['ember-games', 'pixel-oak'], tag: 'bonus-buy', q: 'Book & Co, 100%' }),
    ];
    for (const f of cases) expect(parseFilters(serializeFilters(f))).toEqual(f);
  });
});

describe('buildSearch', () => {
  it('returns an empty string when there is nothing to write', () => {
    expect(buildSearch('', DEFAULT_FILTERS)).toBe('');
    expect(buildSearch('?cat=slots', DEFAULT_FILTERS)).toBe('');
  });

  it('keeps non-filter params after the filter params', () => {
    expect(buildSearch('?mock=fail-catalog&cat=live&x=1', withFilters({ sort: 'rtp' }))).toBe(
      '?sort=rtp&mock=fail-catalog&x=1',
    );
  });

  it('keeps mock with default filters', () => {
    expect(buildSearch('?q=old&mock=slow', DEFAULT_FILTERS)).toBe('?mock=slow');
  });
});

describe('sanitizeFilters', () => {
  const catalog = [
    makeGame({ id: '1', provider: 'ember-games', tags: ['jackpot'] }),
    makeGame({ id: '2', provider: 'pixel-oak', tags: ['classic'] }),
  ];

  it('drops providers that are not in the catalog', () => {
    const f = withFilters({ prov: ['ember-games', 'ghost'] });
    expect(sanitizeFilters(f, catalog).prov).toEqual(['ember-games']);
  });

  it('drops a tag that is not in the catalog', () => {
    expect(sanitizeFilters(withFilters({ tag: 'megaways' }), catalog).tag).toBeNull();
  });

  it('returns the same object when nothing is dropped', () => {
    const f = withFilters({ prov: ['pixel-oak'], tag: 'jackpot', q: 'anything' });
    expect(sanitizeFilters(f, catalog)).toBe(f);
  });
});

describe('filtersEqual', () => {
  it('compares by value', () => {
    expect(filtersEqual(withFilters({ prov: ['a'] }), withFilters({ prov: ['a'] }))).toBe(true);
    expect(filtersEqual(withFilters({ prov: ['a'] }), withFilters({ prov: ['a', 'b'] }))).toBe(false);
    expect(filtersEqual(withFilters({ q: 'x' }), DEFAULT_FILTERS)).toBe(false);
  });
});
