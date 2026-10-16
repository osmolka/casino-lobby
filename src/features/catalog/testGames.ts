import type { Game } from './types';

/** Builds a valid Game for tests; override only the fields a test cares about. */
export function makeGame(overrides: Partial<Game> & Pick<Game, 'id'>): Game {
  return {
    title: `Game ${overrides.id}`,
    provider: 'aurora-studios',
    providerName: 'Aurora Studios',
    category: 'slots',
    tags: [],
    rtp: 96,
    minBet: 10,
    maxBet: 10_000,
    releasedAt: '2026-01-01T00:00:00.000Z',
    popularity: 50,
    hue: 180,
    ...overrides,
  };
}
