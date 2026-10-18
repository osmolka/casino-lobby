import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_CACHE_KEY } from '../catalog/api';
import { makeGame } from '../catalog/testGames';
import { FeedError, connectFeed } from './api';

const games = [makeGame({ id: 'g1', title: 'Book of Embers' }), makeGame({ id: 'g2', title: 'Lightning Roulette' })];

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify(games), { status: 200 })));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function start(search = '', random = () => 0) {
  const promise = connectFeed({ search, random });
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

describe('connectFeed', () => {
  it('waits 400–900 ms, then returns id + title of every game from the shared loader', async () => {
    const settled = start('', () => 0.999999);
    await vi.advanceTimersByTimeAsync(899);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled).toEqual({
      ok: true,
      value: [
        { id: 'g1', title: 'Book of Embers' },
        { id: 'g2', title: 'Lightning Roulette' },
      ],
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/games.json');
  });

  it('fails with ?mock=fail-feed without fetching', async () => {
    const settled = start('?mock=fail-feed');
    await vi.advanceTimersByTimeAsync(400);
    const result = await settled;
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error).toBeInstanceOf(FeedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns no games with ?mock=empty-feed', async () => {
    const settled = start('?mock=empty-feed');
    await vi.advanceTimersByTimeAsync(400);
    expect(await settled).toEqual({ ok: true, value: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns a failed load into FeedError', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    const settled = start();
    await vi.advanceTimersByTimeAsync(400);
    const result = await settled;
    expect(result.ok ? null : result.error).toBeInstanceOf(FeedError);
  });

  it.each([
    ['a rejected fetch', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 503', () => Promise.resolve(new Response('nope', { status: 503 }))],
  ])('falls back to the titles saved in catalog:v1 after %s (agrees with the offline catalog)', async (_label, impl) => {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ fetchedAt: 1, games: [makeGame({ id: 's1', title: 'Saved Only' })] }));
    fetchMock.mockImplementation(impl);
    const settled = start();
    await vi.advanceTimersByTimeAsync(400);
    expect(await settled).toEqual({ ok: true, value: [{ id: 's1', title: 'Saved Only' }] });
  });

  it('does not fall back for a damaged response', async () => {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ fetchedAt: 1, games }));
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));
    const settled = start();
    await vi.advanceTimersByTimeAsync(400);
    const result = await settled;
    expect(result.ok ? null : result.error).toBeInstanceOf(FeedError);
  });

  it('adds extra delay with ?mock=slow', async () => {
    const settled = start('?mock=slow');
    await vi.advanceTimersByTimeAsync(400);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2500);
    expect((await settled).ok).toBe(true);
  });
});
