import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURE_SEED, generateGames } from './games-fixture.ts';

const games = generateGames(FIXTURE_SEED);

describe('games fixture', () => {
  it('is deterministic for a seed', () => {
    expect(generateGames(FIXTURE_SEED)).toEqual(games);
    expect(generateGames(FIXTURE_SEED + 1)).not.toEqual(games);
  });

  it('has 100 games with unique ids and titles', () => {
    expect(games).toHaveLength(100);
    expect(new Set(games.map((g) => g.id)).size).toBe(100);
    expect(new Set(games.map((g) => g.title)).size).toBe(100);
  });

  it('covers all 3 categories and about 8 providers', () => {
    expect(new Set(games.map((g) => g.category))).toEqual(new Set(['slots', 'table', 'live']));
    expect(new Set(games.map((g) => g.provider)).size).toBe(8);
  });

  it('has realistic RTP and integer bets in minor units', () => {
    for (const g of games) {
      expect(g.rtp).toBeGreaterThanOrEqual(94);
      expect(g.rtp).toBeLessThanOrEqual(98);
      expect(Number.isInteger(g.minBet) && Number.isInteger(g.maxBet)).toBe(true);
      expect(g.minBet).toBeGreaterThan(0);
      expect(g.minBet).toBeLessThan(g.maxBet);
      expect(Number.isNaN(Date.parse(g.releasedAt))).toBe(false);
      expect(g.hue).toBeGreaterThanOrEqual(0);
      expect(g.hue).toBeLessThan(360);
    }
  });

  it('matches the committed public/api/games.json', () => {
    const committed: unknown = JSON.parse(readFileSync('public/api/games.json', 'utf8'));
    expect(committed).toEqual(games);
  });
});
