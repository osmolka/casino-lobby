import type { FeedGame, Win } from './types';

export const MIN_DELAY_MS = 1200;
export const MAX_DELAY_MS = 3000;
/** €5.00 and €5,000.00 in cents. */
export const MIN_WIN = 500;
export const MAX_WIN = 500_000;

// Mock player names (data, not UI text).
const FIRST_NAMES = ['Mila', 'Jonas', 'Aiko', 'Lucas', 'Sofia', 'Mateo', 'Nora', 'Elias', 'Zoe', 'Ivan', 'Lena', 'Omar', 'Ines', 'Theo', 'Yara', 'Felix', 'Ada', 'Hugo', 'Maja', 'Leo'];
const LAST_INITIALS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'V', 'W'];

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.floor(random() * list.length)] as T;

/** Next tick delay, integer ms in [MIN_DELAY_MS, MAX_DELAY_MS]. */
export function nextDelay(random: () => number): number {
  return MIN_DELAY_MS + Math.floor(random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
}

/** Between MIN_WIN and MAX_WIN on a log scale, squared exponent: most wins are small (median ≈ €28), a few are big. */
function winAmount(random: () => number): number {
  const r = random();
  return Math.min(MAX_WIN, Math.round(MIN_WIN * (MAX_WIN / MIN_WIN) ** (r * r)));
}

/** `games` must not be empty. */
export function makeWin(random: () => number, games: readonly FeedGame[], at: number, seq: number): Win {
  const game = pick(games, random);
  return {
    id: `w${seq}`,
    player: `${pick(FIRST_NAMES, random)} ${pick(LAST_INITIALS, random)}.`,
    hue: Math.floor(random() * 360),
    gameId: game.id,
    gameTitle: game.title,
    amount: winAmount(random),
    at,
  };
}

/** `count` past wins, newest first, 20–120 s apart, so the feed is not empty on connect. */
export function seedWins(random: () => number, games: readonly FeedGame[], now: number, count: number): Win[] {
  if (games.length === 0) return [];
  const wins: Win[] = [];
  let at = now;
  for (let i = 0; i < count; i++) {
    at -= 20_000 + Math.floor(random() * 100_000);
    wins.push(makeWin(random, games, at, -(i + 1)));
  }
  return wins;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => /\p{L}/u.exec(word)?.[0] ?? '')
    .join('')
    .toUpperCase();
}
