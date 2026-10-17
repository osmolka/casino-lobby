import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANIMATION_MS, tween, useAnimatedNumber } from './useAnimatedNumber';

// Manual frame loop: frames run only when the test says so, like a tab that may be hidden.
let now = 0;
let queue = new Map<number, FrameRequestCallback>();
let nextId = 1;

function frame(ms = 16) {
  now += ms;
  const callbacks = [...queue.values()];
  queue = new Map();
  act(() => {
    for (const cb of callbacks) cb(now);
  });
}

function run(hook: { result: { current: number } }, ms: number, step = 16): number[] {
  const seen: number[] = [];
  for (let t = 0; t < ms; t += step) {
    frame(step);
    seen.push(hook.result.current);
  }
  return seen;
}

function setReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches && query.includes('reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  now = 1000;
  queue = new Map();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.set(nextId, cb);
    return nextId++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id));
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  setReducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('tween', () => {
  it('starts at from, ends at to, stays integer and in range', () => {
    expect(tween(100, 500, 0)).toBe(100);
    expect(tween(100, 500, 1)).toBe(500);
    expect(tween(100, 500, 7)).toBe(500);
    expect(tween(100, 500, -1)).toBe(100);
    for (let p = 0; p <= 1; p += 0.05) {
      const v = tween(500, 100, p);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(100);
      expect(v).toBeLessThanOrEqual(500);
    }
  });
});

describe('useAnimatedNumber', () => {
  it('shows the initial value without animating', () => {
    const hook = renderHook(() => useAnimatedNumber(69_525));
    expect(hook.result.current).toBe(69_525);
  });

  it('animates to a new value over time (delta time), monotonic, integers, exact end', () => {
    const hook = renderHook(({ v }) => useAnimatedNumber(v), { initialProps: { v: 1000 } });
    hook.rerender({ v: 11_000 });
    expect(hook.result.current).toBe(1000);
    const seen = run(hook, ANIMATION_MS + 32);
    expect(seen.some((v) => v > 1000 && v < 11_000)).toBe(true);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.every(Number.isInteger)).toBe(true);
    expect(hook.result.current).toBe(11_000);
    expect(queue.size).toBe(0);
  });

  it('progress follows elapsed time, not frame count: one late frame lands at the same point', () => {
    const a = renderHook(({ v }) => useAnimatedNumber(v), { initialProps: { v: 0 } });
    a.rerender({ v: 10_000 });
    frame(ANIMATION_MS / 2);
    const half = a.result.current;
    a.unmount();
    expect(half).toBe(tween(0, 10_000, 0.5));
  });

  it('optimistic rise then rollback mid-way: continues from the shown value, never negative, ends at the original', () => {
    const hook = renderHook(({ v }) => useAnimatedNumber(v), { initialProps: { v: 500 } });
    hook.rerender({ v: 10_500 });
    run(hook, ANIMATION_MS / 3);
    const shown = hook.result.current;
    expect(shown).toBeGreaterThan(500);
    expect(shown).toBeLessThan(10_500);

    hook.rerender({ v: 500 });
    const back = run(hook, ANIMATION_MS + 32);
    // No jump: the first frame after the rollback is close to where it was.
    expect(Math.abs((back[0] ?? 0) - shown)).toBeLessThan(10_000 * 0.15);
    expect(back).toEqual([...back].sort((a, b) => b - a));
    expect(Math.min(...back)).toBe(500);
    expect(hook.result.current).toBe(500);
  });

  it('a rapid sequence of targets never leaves the overall range and ends at the last one', () => {
    const hook = renderHook(({ v }) => useAnimatedNumber(v), { initialProps: { v: 0 } });
    const seen: number[] = [];
    for (const v of [5000, 0, 9000, 100, 7000, 0, 3000]) {
      hook.rerender({ v });
      seen.push(...run(hook, 48));
    }
    seen.push(...run(hook, ANIMATION_MS + 32));
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...seen)).toBeLessThanOrEqual(9000);
    expect(hook.result.current).toBe(3000);
  });

  it('hidden tab (no frames for a while): the first frame after return shows the final value', () => {
    const hook = renderHook(({ v }) => useAnimatedNumber(v), { initialProps: { v: 1000 } });
    hook.rerender({ v: 2000 });
    frame(60_000);
    expect(hook.result.current).toBe(2000);
    expect(queue.size).toBe(0);
  });

  it('prefers-reduced-motion: the new value is shown at once, no frames scheduled', () => {
    setReducedMotion(true);
    const hook = renderHook(({ v }) => useAnimatedNumber(v), { initialProps: { v: 1000 } });
    hook.rerender({ v: 2000 });
    expect(hook.result.current).toBe(2000);
    expect(queue.size).toBe(0);
  });

  it('unmount cancels the pending frame', () => {
    const hook = renderHook(({ v }) => useAnimatedNumber(v), { initialProps: { v: 1000 } });
    hook.rerender({ v: 2000 });
    expect(queue.size).toBe(1);
    hook.unmount();
    expect(queue.size).toBe(0);
  });

  it('StrictMode double mount leaves a single frame loop', () => {
    const hook = renderHook(({ v }) => useAnimatedNumber(v), { initialProps: { v: 1000 }, reactStrictMode: true });
    hook.rerender({ v: 2000 });
    expect(queue.size).toBe(1);
    run(hook, ANIMATION_MS + 32);
    expect(hook.result.current).toBe(2000);
    expect(queue.size).toBe(0);
  });
});
