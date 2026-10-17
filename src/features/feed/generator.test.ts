import { describe, expect, it } from 'vitest';
import { MAX_DELAY_MS, MAX_WIN, MIN_DELAY_MS, MIN_WIN, initials, makeWin, nextDelay, seedWins } from './generator';
import type { FeedGame } from './types';

const games: FeedGame[] = [
  { id: 'a', title: 'Book of Embers' },
  { id: 'b', title: 'Lightning Roulette' },
];

/** Deterministic floats in [0, 1) (LCG), for repeatable runs. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('nextDelay', () => {
  it('jitters between 1.2 and 3 s inclusive', () => {
    expect(nextDelay(() => 0)).toBe(MIN_DELAY_MS);
    expect(nextDelay(() => 0.999999)).toBe(MAX_DELAY_MS);
    expect(MIN_DELAY_MS).toBe(1200);
    expect(MAX_DELAY_MS).toBe(3000);
    const random = lcg(1);
    for (let i = 0; i < 1000; i++) {
      const ms = nextDelay(random);
      expect(Number.isInteger(ms)).toBe(true);
      expect(ms).toBeGreaterThanOrEqual(MIN_DELAY_MS);
      expect(ms).toBeLessThanOrEqual(MAX_DELAY_MS);
    }
  });
});

describe('makeWin', () => {
  it('builds a win from the given game list, time and sequence number', () => {
    const win = makeWin(() => 0, games, 1_000, 7);
    expect(win).toMatchObject({ id: 'w7', gameId: 'a', gameTitle: 'Book of Embers', amount: MIN_WIN, at: 1_000, hue: 0 });
    expect(win.player).toMatch(/^\p{Lu}\p{L}+ \p{Lu}\.$/u);
  });

  it('keeps amounts in integer cents within the range and hues within 0–359', () => {
    const random = lcg(2);
    for (let i = 0; i < 2000; i++) {
      const win = makeWin(random, games, 0, i);
      expect(Number.isInteger(win.amount)).toBe(true);
      expect(win.amount).toBeGreaterThanOrEqual(MIN_WIN);
      expect(win.amount).toBeLessThanOrEqual(MAX_WIN);
      expect(Number.isInteger(win.hue)).toBe(true);
      expect(win.hue).toBeGreaterThanOrEqual(0);
      expect(win.hue).toBeLessThan(360);
      expect(games.some((g) => g.id === win.gameId && g.title === win.gameTitle)).toBe(true);
    }
  });

  it('skews towards small wins (median below €100)', () => {
    const random = lcg(3);
    const amounts = Array.from({ length: 1001 }, (_, i) => makeWin(random, games, 0, i).amount).sort((a, b) => a - b);
    expect(amounts[500]).toBeLessThan(10_000);
  });

  it('is deterministic for the same random source', () => {
    const run = (random: () => number) => Array.from({ length: 20 }, (_, i) => makeWin(random, games, 0, i));
    expect(run(lcg(4))).toEqual(run(lcg(4)));
  });
});

describe('seedWins', () => {
  it('returns newest-first wins in the past with unique ids', () => {
    const wins = seedWins(lcg(5), games, 1_000_000, 8);
    expect(wins).toHaveLength(8);
    expect(new Set(wins.map((w) => w.id)).size).toBe(8);
    for (let i = 1; i < wins.length; i++) expect(wins[i - 1]?.at).toBeGreaterThan(wins[i]?.at ?? Infinity);
    expect(wins.every((w) => w.at < 1_000_000)).toBe(true);
  });

  it('returns nothing without games', () => {
    expect(seedWins(lcg(6), [], 0, 8)).toEqual([]);
  });
});

describe('initials', () => {
  it('takes the first letter of each word', () => {
    expect(initials('Mila K.')).toBe('MK');
    expect(initials('Øyvind S.')).toBe('ØS');
    expect(initials('  ')).toBe('');
  });
});
