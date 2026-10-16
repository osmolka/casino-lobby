import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_CACHE_KEY, CatalogError, fetchCatalog } from './api';
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
    await expect(promise).resolves.toEqual(games);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/games.json');
  });

  it('keeps the delay within 400–900 ms', async () => {
    const { promise } = start({ random: () => 0.999999 });
    await vi.advanceTimersByTimeAsync(899);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual(games);
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
    await expect(promise).resolves.toEqual(games);
  });

  it('accepts an empty catalog', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const { promise } = start();
    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toEqual([]);
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
