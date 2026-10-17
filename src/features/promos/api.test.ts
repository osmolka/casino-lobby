import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROMOS_URL, PromosError, fetchPromos } from './api';

const promos = [
  { id: 'liveWeek', hue: 350, filters: 'cat=live' },
  { id: 'jackpotHunt', hue: 42, filters: 'tag=jackpot' },
];

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function respond(body: string, status = 200) {
  fetchMock.mockImplementation(() => Promise.resolve(new Response(body, { status })));
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn<typeof fetch>();
  respond(JSON.stringify(promos));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function start(search = '', random = () => 0, signal?: AbortSignal) {
  return fetchPromos({ search, random, ...(signal ? { signal } : {}) }).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

async function settle<T>(promise: Promise<T>, ms = 3700): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms);
  return promise;
}

describe('fetchPromos', () => {
  it('waits 600–1100 ms, then returns the validated promos', async () => {
    const settled = start('', () => 0.999999);
    await vi.advanceTimersByTimeAsync(1099);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled).toEqual({ ok: true, value: promos });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/promos.json');
    expect(PROMOS_URL).toBe('/api/promos.json');
  });

  it('?mock=slow adds 2500 ms', async () => {
    const settled = start('?mock=slow');
    await vi.advanceTimersByTimeAsync(600 + 2499);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect((await settled).ok).toBe(true);
  });

  it('?mock=fail-promos rejects with PromosError without fetching', async () => {
    const result = await settle(start('?mock=fail-promos'));
    expect(result.ok ? null : result.error).toBeInstanceOf(PromosError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('?mock=empty-promos resolves to [] without fetching', async () => {
    expect(await settle(start('?mock=empty-promos'))).toEqual({ ok: true, value: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a network failure, HTTP 500, broken JSON and a bad shape reject with PromosError', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    let result = await settle(start());
    expect(result.ok ? null : result.error).toBeInstanceOf(PromosError);

    for (const [body, status] of [['[]', 500], ['{', 200], ['{"promos":[]}', 200]] as const) {
      respond(body, status);
      result = await settle(start());
      expect(result.ok ? null : result.error, `${status} ${body}`).toBeInstanceOf(PromosError);
    }
  });

  it('drops promos without copy and keeps the rest', async () => {
    respond(JSON.stringify([{ id: 'unknown', hue: 1, filters: 'cat=live' }, ...promos]));
    expect(await settle(start())).toEqual({ ok: true, value: promos });
  });

  it('rejects with the AbortError when aborted during the delay, without fetching', async () => {
    const controller = new AbortController();
    const settled = start('', () => 0, controller.signal);
    controller.abort();
    const result = await settle(settled);
    expect(result.ok ? null : (result.error as Error).name).toBe('AbortError');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with the AbortError (not PromosError) when aborted during the request', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    const settled = start('', () => 0, controller.signal);
    await vi.advanceTimersByTimeAsync(600);
    expect(fetchMock).toHaveBeenCalledOnce();
    controller.abort();
    const result = await settled;
    expect(result.ok ? null : result.error).not.toBeInstanceOf(PromosError);
    expect(result.ok ? null : (result.error as Error).name).toBe('AbortError');
  });
});
