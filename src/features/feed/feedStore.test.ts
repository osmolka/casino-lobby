import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUFFER_SIZE, createFeedStore, type FeedStore } from './feedStore';
import { MIN_DELAY_MS } from './generator';
import type { FeedGame } from './types';

const games: FeedGame[] = [{ id: 'a', title: 'Book of Embers' }];

let unsubscribers: (() => void)[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T12:00:00.000Z'));
});

afterEach(() => {
  for (const off of unsubscribers) off();
  unsubscribers = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** random = 0 → every delay is exactly MIN_DELAY_MS. */
function makeStore(options: Partial<Parameters<typeof createFeedStore>[0]> = {}): FeedStore {
  return createFeedStore({ games, random: () => 0, seed: 0, ...options });
}

function subscribe(store: FeedStore, listener = vi.fn()) {
  const off = store.subscribe(listener);
  unsubscribers.push(off);
  return off;
}

const count = (store: FeedStore) => store.getSnapshot().wins.length;
const reasons = (store: FeedStore) => [...store.getSnapshot().reasons].sort();

function setHidden(hidden: boolean) {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('createFeedStore', () => {
  it('seeds the buffer newest first', () => {
    const store = makeStore({ seed: 8 });
    expect(count(store)).toBe(8);
  });

  it('generates nothing without subscribers', () => {
    const store = makeStore();
    vi.advanceTimersByTime(60_000);
    expect(count(store)).toBe(0);
  });

  it('adds one win per tick and notifies subscribers', () => {
    const store = makeStore();
    const listener = vi.fn();
    subscribe(store, listener);
    vi.advanceTimersByTime(MIN_DELAY_MS - 1);
    expect(count(store)).toBe(0);
    vi.advanceTimersByTime(1);
    expect(count(store)).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MIN_DELAY_MS * 9);
    expect(count(store)).toBe(10);
  });

  it('holds exactly 50 entries after 5 minutes', () => {
    const store = makeStore({ random: Math.random, seed: 8 });
    subscribe(store);
    vi.advanceTimersByTime(5 * 60_000);
    const { wins } = store.getSnapshot();
    expect(BUFFER_SIZE).toBe(50);
    expect(wins).toHaveLength(50);
    expect(new Set(wins.map((w) => w.id)).size).toBe(50);
    expect(wins[0]?.at).toBeGreaterThan(wins[49]?.at ?? Infinity);
  });

  it('does not accumulate while paused and does not dump on resume', () => {
    const store = makeStore();
    subscribe(store);
    vi.advanceTimersByTime(MIN_DELAY_MS);
    expect(count(store)).toBe(1);

    store.pause('user');
    vi.advanceTimersByTime(10 * 60_000);
    expect(count(store)).toBe(1);

    store.resume('user');
    expect(count(store)).toBe(1);
    vi.advanceTimersByTime(MIN_DELAY_MS - 1);
    expect(count(store)).toBe(1);
    vi.advanceTimersByTime(1);
    expect(count(store)).toBe(2);
  });

  it('runs only when every pause reason is gone', () => {
    const store = makeStore();
    subscribe(store);
    store.pause('hover');
    store.pause('focus');
    store.resume('hover');
    vi.advanceTimersByTime(60_000);
    expect(count(store)).toBe(0);
    expect(reasons(store)).toEqual(['focus']);
    store.resume('focus');
    vi.advanceTimersByTime(MIN_DELAY_MS);
    expect(count(store)).toBe(1);
  });

  it('a pause mid-delay restarts the jitter after resume', () => {
    const store = makeStore();
    subscribe(store);
    vi.advanceTimersByTime(MIN_DELAY_MS - 100);
    store.pause('hover');
    store.resume('hover');
    vi.advanceTimersByTime(100);
    expect(count(store)).toBe(0);
    vi.advanceTimersByTime(MIN_DELAY_MS - 100);
    expect(count(store)).toBe(1);
  });

  it('pause/resume with an unchanged reason does not notify', () => {
    const store = makeStore();
    const listener = vi.fn();
    subscribe(store, listener);
    store.resume('user');
    store.pause('user');
    store.pause('user');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribe → unsubscribe → subscribe (StrictMode) keeps a single timer', () => {
    const store = makeStore();
    const off = store.subscribe(vi.fn());
    off();
    subscribe(store);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(MIN_DELAY_MS);
    expect(count(store)).toBe(1);
  });

  it('two subscribers share one timer; the last unsubscribe stops it', () => {
    const store = makeStore();
    const offA = store.subscribe(vi.fn());
    const offB = store.subscribe(vi.fn());
    expect(vi.getTimerCount()).toBe(1);
    offA();
    expect(vi.getTimerCount()).toBe(1);
    offB();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses while the tab is hidden', () => {
    const store = makeStore();
    subscribe(store);
    setHidden(true);
    expect(reasons(store)).toEqual(['hidden']);
    vi.advanceTimersByTime(60_000);
    expect(count(store)).toBe(0);
    setHidden(false);
    expect(reasons(store)).toEqual([]);
    vi.advanceTimersByTime(MIN_DELAY_MS);
    expect(count(store)).toBe(1);
  });

  it('starts paused when the tab is already hidden on subscribe', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const store = makeStore();
    subscribe(store);
    expect(reasons(store)).toEqual(['hidden']);
    vi.advanceTimersByTime(60_000);
    expect(count(store)).toBe(0);
  });

  it('pauses while offline and starts paused when offline on subscribe', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const store = makeStore();
    subscribe(store);
    expect(reasons(store)).toEqual(['offline']);
    vi.advanceTimersByTime(60_000);
    expect(count(store)).toBe(0);

    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    expect(reasons(store)).toEqual([]);
    vi.advanceTimersByTime(MIN_DELAY_MS);
    expect(count(store)).toBe(1);

    onLine.mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    expect(reasons(store)).toEqual(['offline']);
  });

  it('stops listening to the document after the last unsubscribe', () => {
    const store = makeStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    setHidden(true);
    expect(listener).not.toHaveBeenCalled();
    expect(reasons(store)).toEqual([]);
  });

  it('never generates without games', () => {
    const store = makeStore({ games: [], seed: 8 });
    subscribe(store);
    vi.advanceTimersByTime(60_000);
    expect(count(store)).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the snapshot reference stable between changes', () => {
    const store = makeStore();
    subscribe(store);
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);
    vi.advanceTimersByTime(MIN_DELAY_MS);
    expect(store.getSnapshot()).not.toBe(first);
  });
});
