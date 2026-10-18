import type { MessageKey } from '../../i18n/types';
import { delay } from '../../shared/delay';
import { getMockFlags } from '../../shared/mockFlags';
import { storageGet, storageSet } from '../../shared/storage';
import { CATEGORIES } from './filters';
import type { Game } from './types';

export const CATALOG_URL = `${import.meta.env.BASE_URL}api/games.json`;
/** `{ fetchedAt: number (ms epoch), games: Game[] }`. Read back by the offline fallback (H2). */
export const CATALOG_CACHE_KEY = 'catalog:v1';

const MIN_DELAY_MS = 400;
const MAX_DELAY_MS = 900;
const SLOW_EXTRA_MS = 2500;

export type CatalogErrorKind = 'network' | 'http' | 'invalid';

export const CATALOG_ERROR_KEYS: Record<CatalogErrorKind, MessageKey> = {
  network: 'catalog.error.network',
  http: 'catalog.error.http',
  invalid: 'catalog.error.invalid',
};

export class CatalogError extends Error {
  override readonly name = 'CatalogError';

  constructor(
    readonly kind: CatalogErrorKind,
    readonly status?: number,
  ) {
    super(status === undefined ? kind : `${kind} ${status}`);
  }
}

export interface FetchCatalogOptions {
  signal?: AbortSignal;
  /** Defaults to `window.location.search`; read for `?mock=`. */
  search?: string;
  /** Injected for deterministic delays in tests. */
  random?: () => number;
}

const isInt = (v: unknown): v is number => Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function isGame(value: unknown): value is Game {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Record<keyof Game, unknown>;
  return (
    isStr(g.id) &&
    isStr(g.title) &&
    isStr(g.provider) &&
    isStr(g.providerName) &&
    CATEGORIES.some((c) => c === g.category) &&
    Array.isArray(g.tags) &&
    g.tags.every(isStr) &&
    isNum(g.rtp) &&
    isInt(g.minBet) &&
    isInt(g.maxBet) &&
    isStr(g.releasedAt) &&
    !Number.isNaN(Date.parse(g.releasedAt)) &&
    isNum(g.popularity) &&
    isNum(g.hue)
  );
}

/**
 * Fetches and validates `api/games.json`, and caches it in catalog:v1. No artificial delay, no mock flags:
 * shared by the catalog and the live feed (game titles). Rejects with CatalogError, or with the signal's
 * AbortError when aborted.
 */
export async function loadGames(signal?: AbortSignal): Promise<Game[]> {
  let response: Response;
  try {
    // no-cache: revalidate with the server, never answer from the HTTP cache. Offline data comes only from
    // catalog:v1, so the fallback path below (banner with the saved time) is the one that runs.
    response = await fetch(CATALOG_URL, signal ? { signal, cache: 'no-cache' } : { cache: 'no-cache' });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new CatalogError('network');
  }
  if (!response.ok) throw new CatalogError('http', response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new CatalogError('invalid');
  }
  if (!Array.isArray(body) || !body.every(isGame)) throw new CatalogError('invalid');

  // storageSet swallows quota/privacy errors, so a failed write never fails the fetch.
  storageSet(CATALOG_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), games: body }));
  return body;
}

export interface CachedCatalog {
  fetchedAt: number;
  games: Game[];
}

/** The last good response from catalog:v1, or null when missing, unreadable or damaged. */
export function readCachedCatalog(): CachedCatalog | null {
  const raw = storageGet(CATALOG_CACHE_KEY);
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { fetchedAt, games } = value as Partial<Record<keyof CachedCatalog, unknown>>;
  if (!isNum(fetchedAt) || !Array.isArray(games) || !games.every(isGame)) return null;
  return { fetchedAt, games };
}

/**
 * A failed request (no network, or not ok) may be answered from catalog:v1. A damaged body is not a
 * connectivity problem and keeps its error.
 */
export function canUseSavedCatalog(error: unknown): error is CatalogError {
  return error instanceof CatalogError && error.kind !== 'invalid';
}

export interface CatalogData {
  games: Game[];
  /** null: fresh from the server. Otherwise the fetch failed and these are the games saved at this time. */
  savedAt: number | null;
}

/**
 * Loads the catalog after the artificial delay (`?mock=slow|fail-catalog`). When the request fails and
 * catalog:v1 held a saved copy when the attempt started, resolves with it and its `savedAt` (H2); a copy the
 * live feed saves during the attempt does not count, so `?mock=fail-catalog` on a first visit is always the
 * error state. Otherwise rejects with CatalogError, or with the signal's AbortError when aborted.
 */
export async function fetchCatalog(options: FetchCatalogOptions = {}): Promise<CatalogData> {
  const { signal, search = window.location.search, random = Math.random } = options;
  const mock = getMockFlags(search);
  const saved = readCachedCatalog();

  const ms = MIN_DELAY_MS + Math.floor(random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  await delay(mock.has('slow') ? ms + SLOW_EXTRA_MS : ms, signal);
  try {
    if (mock.has('fail-catalog')) throw new CatalogError('network');
    return { games: await loadGames(signal), savedAt: null };
  } catch (error) {
    if (!saved || !canUseSavedCatalog(error)) throw error;
    return { games: saved.games, savedAt: saved.fetchedAt };
  }
}
