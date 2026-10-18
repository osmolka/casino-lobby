import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_CACHE_KEY, CatalogError, fetchCatalog, readCachedCatalog } from './api';
import { makeGame } from './testGames';

const games = [makeGame({ id: 'g1' }), makeGame({ id: 'g2', category: 'live' })];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
  fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(games)));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

/** Starts a fetch and attaches a catch handler so rejections before `await` are not reported as unhandled. */
function start(options: Parameters<typeof fetchCatalog>[0] = {}) {
  const promise = fetchCatalog({ search: '', random: () => 0, ...options });
  const settled = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  return { promise, settled };
}

async function expectCatalogError(settled: Promise<{ ok: boolean; error?: unknown }>, kind: string) {
  const result = await settled;
  expect(result.ok).toBe(false);
  expect(result.error).toBeInstanceOf(CatalogError);
  expect((result.error as CatalogError).kind).toBe(kind);
}

describe('fetchCatalog', () => {
  it('waits for the artificial delay before fetching', async () => {
    const { promise } = start();
    await vi.advanceTimersByTimeAsync(399);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ games, savedAt: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/games.json');
  });

  it('revalidates with the server instead of reading the HTTP cache (catalog:v1 is the only offline copy)', async () => {
    const { promise } = start();
    await vi.advanceTimersByTimeAsync(400);
    await promise;
    expect(fetchMock.mock.calls[0]?.[1]?.cache).toBe('no-cache');
  });

  it('keeps the delay within 400–900 ms', async () => {
    const { promise } = start({ random: () => 0.999999 });
    await vi.advanceTimersByTimeAsync(899);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ games, savedAt: null });
  });

  it('adds extra delay with ?mock=slow', async () => {
    const { settled } = start({ search: '?mock=slow' });
    await vi.advanceTimersByTimeAsync(900);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2500);
    expect((await settled).ok).toBe(true);
  });

  it('saves the response to catalog:v1 with fetchedAt', async () => {
    const { promise } = start();
    await vi.advanceTimersByTimeAsync(400);
    await promise;
    const cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) ?? 'null') as unknown;
    expect(cached).toEqual({ fetchedAt: Date.parse('2026-10-16T12:00:00.400Z'), games });
  });

  it('still resolves when the cache write throws', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { promise } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toEqual({ games, savedAt: null });
  });

  it('accepts an empty catalog', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const { promise } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toEqual({ games: [], savedAt: null });
  });

  it('maps a fetch rejection (TypeError) to kind "network"', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { settled } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expectCatalogError(settled, 'network');
  });

  it('maps a non-ok response to kind "http" with the status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));
    const { settled } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expectCatalogError(settled, 'http');
    expect(((await settled) as { error: CatalogError }).error.status).toBe(500);
  });

  it('maps a non-JSON body to kind "invalid"', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }));
    const { settled } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expectCatalogError(settled, 'invalid');
  });

  it.each([
    ['an object instead of an array', { games }],
    ['an item with a missing field', [{ ...games[0], title: undefined }]],
    ['an item with an unknown category', [{ ...games[0], category: 'bingo' }]],
    ['an item with fractional minor units', [{ ...games[0], minBet: 0.5 }]],
    ['an item with non-string tags', [{ ...games[0], tags: [1] }]],
  ])('maps a body with %s to kind "invalid"', async (_label, body) => {
    fetchMock.mockResolvedValueOnce(jsonResponse(body));
    const { settled } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expectCatalogError(settled, 'invalid');
    expect(localStorage.getItem(CATALOG_CACHE_KEY)).toBeNull();
  });

  it('fails with ?mock=fail-catalog without calling fetch', async () => {
    const { settled } = start({ search: '?mock=fail-catalog' });
    await vi.advanceTimersByTimeAsync(400);
    await expectCatalogError(settled, 'network');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with AbortError when aborted during the delay and never fetches', async () => {
    const controller = new AbortController();
    const { settled } = start({ signal: controller.signal });
    controller.abort();
    const result = await settled;
    expect(result.ok).toBe(false);
    expect((result as { error: DOMException }).error.name).toBe('AbortError');
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes the signal to fetch and rethrows its AbortError as is', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce((_url, init) => {
      expect(init?.signal).toBe(controller.signal);
      controller.abort();
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    });
    const { settled } = start({ signal: controller.signal });
    await vi.advanceTimersByTimeAsync(400);
    const result = await settled;
    expect((result as { error: unknown }).error).not.toBeInstanceOf(CatalogError);
    expect((result as { error: DOMException }).error.name).toBe('AbortError');
  });
});

const SAVED_AT = Date.parse('2026-10-15T08:00:00.000Z');
const savedGames = [makeGame({ id: 'saved-1', title: 'Saved Only' })];

function saveCatalog(value: unknown = { fetchedAt: SAVED_AT, games: savedGames }) {
  localStorage.setItem(CATALOG_CACHE_KEY, typeof value === 'string' ? value : JSON.stringify(value));
}

describe('readCachedCatalog', () => {
  it('returns the saved games and when they were fetched', () => {
    saveCatalog();
    expect(readCachedCatalog()).toEqual({ fetchedAt: SAVED_AT, games: savedGames });
  });

  it('returns null when nothing is saved', () => {
    expect(readCachedCatalog()).toBeNull();
  });

  it.each([
    ['not JSON', '{oops'],
    ['an array', [savedGames]],
    ['no fetchedAt', { games: savedGames }],
    ['a string fetchedAt', { fetchedAt: '2026-10-15', games: savedGames }],
    ['a non-finite fetchedAt', { fetchedAt: null, games: savedGames }],
    ['games not an array', { fetchedAt: SAVED_AT, games: {} }],
    ['an invalid game', { fetchedAt: SAVED_AT, games: [{ ...savedGames[0], rtp: '96' }] }],
  ])('returns null for %s', (_label, value) => {
    saveCatalog(value);
    expect(readCachedCatalog()).toBeNull();
  });

  it('returns null when localStorage throws', () => {
    saveCatalog();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readCachedCatalog()).toBeNull();
  });
});

describe('fetchCatalog offline fallback (catalog:v1)', () => {
  it('serves the saved catalog with savedAt when fetch rejects', async () => {
    saveCatalog();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { promise } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toEqual({ games: savedGames, savedAt: SAVED_AT });
  });

  it('serves the saved catalog when the response is not ok', async () => {
    saveCatalog();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 503));
    const { promise } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toEqual({ games: savedGames, savedAt: SAVED_AT });
  });

  it('serves the saved catalog for ?mock=fail-catalog (H2 demo without DevTools)', async () => {
    saveCatalog();
    const { promise } = start({ search: '?mock=fail-catalog' });
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toEqual({ games: savedGames, savedAt: SAVED_AT });
  });

  it('uses only a copy saved before the attempt started (the feed saving one meanwhile does not count)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { settled } = start();
    saveCatalog(); // e.g. the live feed's own games request finished during the delay
    await vi.advanceTimersByTimeAsync(400);
    await expectCatalogError(settled, 'network');
  });

  it('keeps the "invalid" error: a damaged response is not a connectivity problem', async () => {
    saveCatalog();
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }));
    const { settled } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expectCatalogError(settled, 'invalid');
  });

  it('fails as before when nothing usable is saved', async () => {
    saveCatalog('{oops');
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { settled } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expectCatalogError(settled, 'network');
  });

  it('a fresh response replaces the saved copy and has savedAt null', async () => {
    saveCatalog();
    const { promise } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toEqual({ games, savedAt: null });
    expect(readCachedCatalog()?.games).toEqual(games);
  });

  it('still rethrows an abort instead of falling back', async () => {
    saveCatalog();
    const controller = new AbortController();
    const { settled } = start({ signal: controller.signal });
    controller.abort();
    const result = await settled;
    expect((result as { error: DOMException }).error.name).toBe('AbortError');
  });

  it('rethrows an abort during the fetch instead of falling back', async () => {
    saveCatalog();
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    });
    const { settled } = start({ signal: controller.signal });
    await vi.advanceTimersByTimeAsync(400);
    const result = await settled;
    expect((result as { error: DOMException }).error.name).toBe('AbortError');
  });
});
