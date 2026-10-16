import { CATEGORIES, DEFAULT_FILTERS, SORTS, type Filters, type Sort } from './filters';
import type { Category, Game } from './types';

export const MAX_QUERY_LENGTH = 100;
const MAX_PROVIDERS = 50;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Canonical order of filter params in the URL. Everything else (e.g. `mock`) is preserved as is. */
const FILTER_KEYS = ['cat', 'prov', 'tag', 'q', 'sort'] as const;
const FILTER_KEY_SET: ReadonlySet<string> = new Set(FILTER_KEYS);

function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | null {
  return allowed.find((item) => item === value) ?? null;
}

function normalizeQuery(q: string): string {
  return q.trim().slice(0, MAX_QUERY_LENGTH);
}

function normalizeProviders(prov: readonly string[]): string[] {
  return [...new Set(prov)].sort();
}

export function normalizeFilters(f: Filters): Filters {
  return { ...f, prov: normalizeProviders(f.prov), q: normalizeQuery(f.q) };
}

/**
 * Step 1 of 2: format validation only, so it can run before the catalog is loaded.
 * Unknown or malformed values fall back to defaults; never throws.
 */
export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const tag = params.get('tag');
  const prov = (params.get('prov') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => SLUG.test(s))
    .slice(0, MAX_PROVIDERS);
  return {
    cat: oneOf<Category>(CATEGORIES, params.get('cat')),
    prov: normalizeProviders(prov),
    tag: tag !== null && SLUG.test(tag) ? tag : null,
    q: normalizeQuery(params.get('q') ?? ''),
    sort: oneOf<Sort>(SORTS, params.get('sort')) ?? DEFAULT_FILTERS.sort,
  };
}

/** Step 2 of 2: drops providers and tags that the loaded catalog does not have. Same object if nothing changed. */
export function sanitizeFilters(f: Filters, games: readonly Game[]): Filters {
  const providers = new Set(games.map((g) => g.provider));
  const prov = f.prov.filter((p) => providers.has(p));
  const tagKnown = f.tag === null || games.some((g) => g.tags.includes(f.tag as string));
  if (prov.length === f.prov.length && tagKnown) return f;
  return { ...f, prov, tag: tagKnown ? f.tag : null };
}

/** Filter params only, canonical order, defaults omitted. No leading "?". */
export function serializeFilters(f: Filters): string {
  const n = normalizeFilters(f);
  const values: Record<(typeof FILTER_KEYS)[number], string | null> = {
    cat: n.cat,
    // Slugs need no encoding; a literal comma keeps the URL readable.
    prov: n.prov.length > 0 ? n.prov.join(',') : null,
    tag: n.tag,
    q: n.q === '' ? null : encodeURIComponent(n.q),
    sort: n.sort === DEFAULT_FILTERS.sort ? null : n.sort,
  };
  return FILTER_KEYS.flatMap((key) => (values[key] === null ? [] : [`${key}=${values[key]}`])).join('&');
}

/** Full search string for `f`, keeping non-filter params from `current` verbatim. Returns '' or '?…'. */
export function buildSearch(current: string, f: Filters): string {
  const rest = current
    .replace(/^\?/, '')
    .split('&')
    .filter((part) => {
      if (part === '') return false;
      const key = new URLSearchParams(part).keys().next().value;
      return key !== undefined && !FILTER_KEY_SET.has(key);
    });
  const parts = [serializeFilters(f), ...rest].filter((part) => part !== '');
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function filtersEqual(a: Filters, b: Filters): boolean {
  return (
    a.cat === b.cat &&
    a.tag === b.tag &&
    a.q === b.q &&
    a.sort === b.sort &&
    a.prov.length === b.prov.length &&
    a.prov.every((p, i) => p === b.prov[i])
  );
}
