import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { CATALOG_CACHE_KEY } from './api';
import { makeGame } from './testGames';
import { useCatalog } from './useCatalog';

const games = [makeGame({ id: 'g1' }), makeGame({ id: 'g2' })];
const SAVED_AT = Date.parse('2026-10-15T08:00:00.000Z');
const savedGames = [makeGame({ id: 'saved-1', title: 'Saved Only' })];
const MAX_DELAY_MS = 900;

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let onLine: MockInstance<() => boolean>;

const ok = () => Promise.resolve(new Response(JSON.stringify(games), { status: 200 }));
const down = () => Promise.reject(new TypeError('Failed to fetch'));

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn<typeof fetch>(ok);
  vi.stubGlobal('fetch', fetchMock);
  onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

function render() {
  return renderHook(() => useCatalog(), { wrapper: StrictMode });
}

async function settle() {
  await act(() => vi.advanceTimersByTimeAsync(MAX_DELAY_MS));
}

function goOnline() {
  onLine.mockReturnValue(true);
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
}

function saveCatalog() {
  localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ fetchedAt: SAVED_AT, games: savedGames }));
}

describe('useCatalog', () => {
  it('fresh data: ready, savedAt null, nothing restored', async () => {
    const { result } = render();
    expect(result.current.status).toBe('loading');
    await settle();
    expect(result.current).toMatchObject({ status: 'ready', games, savedAt: null, restored: false });
  });

  it('failed fetch with catalog:v1 → the saved catalog with savedAt', async () => {
    saveCatalog();
    fetchMock.mockImplementation(down);
    const { result } = render();
    await settle();
    expect(result.current).toMatchObject({ status: 'ready', games: savedGames, savedAt: SAVED_AT });
  });

  it('failed fetch without a cache → error', async () => {
    fetchMock.mockImplementation(down);
    const { result } = render();
    await settle();
    expect(result.current).toMatchObject({ status: 'error', kind: 'network' });
  });

  it('online after an error refetches automatically; the load is marked restored', async () => {
    onLine.mockReturnValue(false);
    fetchMock.mockImplementation(down);
    const { result } = render();
    await settle();
    expect(result.current.status).toBe('error');

    fetchMock.mockImplementation(ok);
    goOnline();
    expect(result.current.status).toBe('loading');
    await settle();
    expect(result.current).toMatchObject({ status: 'ready', games, savedAt: null, restored: true });
  });

  it('going offline clears restored, so a later online event does not announce "Catalog loaded" again', async () => {
    fetchMock.mockImplementation(down);
    const { result } = render();
    await settle();
    fetchMock.mockImplementation(ok);
    goOnline();
    await settle();
    expect(result.current).toMatchObject({ restored: true });

    onLine.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    goOnline();
    expect(result.current).toMatchObject({ status: 'ready', restored: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('online with a saved catalog refetches in the background: the saved games stay until fresh ones arrive', async () => {
    saveCatalog();
    fetchMock.mockImplementation(down);
    const { result } = render();
    await settle();

    fetchMock.mockImplementation(ok);
    goOnline();
    expect(result.current).toMatchObject({ status: 'ready', games: savedGames, savedAt: SAVED_AT });
    await settle();
    expect(result.current).toMatchObject({ status: 'ready', games, savedAt: null, restored: true });
  });

  it('three rapid online events cause one request', async () => {
    fetchMock.mockImplementation(down);
    const { result } = render();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockImplementation(ok);
    goOnline();
    goOnline();
    goOnline();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('ready');
  });

  it('a new attempt aborts the request still in flight', async () => {
    fetchMock.mockImplementation(down);
    const { result } = render();
    await settle();

    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((_url, init) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise(() => {}); // hangs until aborted
    });
    goOnline();
    await act(() => vi.advanceTimersByTimeAsync(MAX_DELAY_MS));
    expect(signals).toHaveLength(1);
    act(() => {
      result.current.retry();
    });
    expect(signals[0]?.aborted).toBe(true);
  });

  it('online does nothing while the catalog is fresh', async () => {
    render();
    await settle();
    goOnline();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a retry that fails again (still offline) ends in the error state', async () => {
    onLine.mockReturnValue(false);
    fetchMock.mockImplementation(down);
    const { result } = render();
    await settle();
    act(() => {
      result.current.retry();
    });
    expect(result.current.status).toBe('loading');
    await settle();
    expect(result.current).toMatchObject({ status: 'error', kind: 'network' });
  });

  it('stops listening for online on unmount', async () => {
    fetchMock.mockImplementation(down);
    const { unmount } = render();
    await settle();
    unmount();
    goOnline();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
