export type Category = 'slots' | 'table' | 'live';

export interface Game {
  id: string;
  title: string;
  /** Provider slug. */
  provider: string;
  providerName: string;
  category: Category;
  /** e.g. 'megaways', 'jackpot', 'classic', 'bonus-buy', 'new' */
  tags: string[];
  /** Percent, e.g. 96.21 */
  rtp: number;
  /** Minor units. */
  minBet: number;
  /** Minor units. */
  maxBet: number;
  /** ISO date-time. */
  releasedAt: string;
  /** Used for "Trending". */
  popularity: number;
  /** 0–359, drives the generated SVG thumbnail. */
  hue: number;
}
