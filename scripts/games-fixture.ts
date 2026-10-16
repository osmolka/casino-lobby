import type { Category, Game } from '../src/features/catalog/types.ts';
import { mulberry32 } from './prng.ts';

export const FIXTURE_SEED = 20261016;

/** Fixed "today" so the 'new' tag and dates do not depend on when the script runs. */
const REFERENCE_DATE = Date.UTC(2026, 9, 1);
const DAY = 86_400_000;
const NEW_WITHIN_DAYS = 45;

const PROVIDERS = [
  ['aurora-studios', 'Aurora Studios'],
  ['blackfin-gaming', 'Blackfin Gaming'],
  ['ember-games', 'Ember Games'],
  ['northlight', 'Northlight'],
  ['pixel-oak', 'Pixel Oak'],
  ['red-lantern', 'Red Lantern'],
  ['silverline-live', 'Silverline Live'],
  ['wildcard-labs', 'Wildcard Labs'],
] as const;

const COUNTS: Record<Category, number> = { slots: 60, table: 20, live: 20 };

const SLOT_ADJECTIVES = [
  'Golden', 'Mystic', 'Wild', 'Lucky', 'Frozen', 'Blazing', 'Ancient', 'Neon', 'Royal', 'Thunder',
  'Crystal', 'Shadow', 'Jungle', 'Cosmic', 'Sugar', 'Pirate', 'Dragon', 'Viking', 'Emerald', 'Midnight',
];
const SLOT_NOUNS = [
  'Fortune', 'Reels', 'Treasure', 'Gems', 'Riches', 'Spins', 'Kingdom', 'Quest', 'Temple', 'Fruits',
  'Legends', 'Vault', 'Safari', 'Nights', 'Storm', 'Empire', 'Oasis', 'Rush', 'Charms', 'Bounty',
];
const SLOT_SUFFIXES = ['', '', '', ' Megaways', ' Deluxe', ' 2', ' Hold & Win', ' XL'];
/** Deliberately long title to exercise ellipsis / overflow handling in the grid. */
const LONG_TITLE = 'The Extraordinarily Long Expedition to the Forgotten Temple of Seven Golden Pharaohs';

const TABLE_BASES = ['Roulette', 'Blackjack', 'Baccarat', 'Casino Hold’em', 'Craps', 'Sic Bo', 'Three Card Poker'];
const TABLE_VARIANTS = ['European', 'American', 'French', 'Classic', 'Multihand', 'Double Ball', 'Premium', 'Mini', 'Zero Commission'];
const LIVE_BASES = ['Roulette', 'Blackjack', 'Baccarat', 'Dream Wheel', 'Dice Duel', 'Game Show', 'Poker'];
const LIVE_VARIANTS = ['Live', 'Speed', 'Lightning', 'VIP', 'Immersive', 'Auto', 'Grand', 'Salon Privé', 'Turbo'];

const SLOT_TAGS = ['megaways', 'jackpot', 'classic', 'bonus-buy'] as const;

function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function generateGames(seed: number): Game[] {
  const rand = mulberry32(seed);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;

  const titles = new Set<string>([LONG_TITLE]);
  const uniqueTitle = (make: () => string): string => {
    for (;;) {
      const title = make();
      if (!titles.has(title)) {
        titles.add(title);
        return title;
      }
    }
  };

  const games: Game[] = [];
  for (const category of ['slots', 'table', 'live'] as const) {
    for (let i = 0; i < COUNTS[category]; i++) {
      // Spread providers evenly first, then shuffle via rand, so all 8 always appear.
      const [provider, providerName] = PROVIDERS[(games.length + int(0, 1)) % PROVIDERS.length] ?? PROVIDERS[0];

      let title: string;
      const tags: string[] = [];
      let minBet: number;
      let maxBet: number;

      if (category === 'slots') {
        title =
          i === 0
            ? LONG_TITLE
            : uniqueTitle(() => `${pick(SLOT_ADJECTIVES)} ${pick(SLOT_NOUNS)}${pick(SLOT_SUFFIXES)}`);
        if (title.endsWith('Megaways')) tags.push('megaways');
        for (const tag of SLOT_TAGS) {
          if (tag !== 'megaways' && rand() < 0.22) tags.push(tag);
        }
        minBet = pick([10, 20, 20, 50]);
        maxBet = pick([5_000, 10_000, 25_000, 50_000]);
      } else if (category === 'table') {
        title = uniqueTitle(() => `${pick(TABLE_VARIANTS)} ${pick(TABLE_BASES)}`);
        if (title.startsWith('Classic')) tags.push('classic');
        minBet = pick([50, 100, 100, 200]);
        maxBet = pick([100_000, 200_000, 500_000]);
      } else {
        title = uniqueTitle(() => `${pick(LIVE_VARIANTS)} ${pick(LIVE_BASES)}`);
        minBet = pick([100, 100, 200, 500]);
        maxBet = pick([250_000, 500_000, 1_000_000]);
      }

      const ageDays = rand() < 0.1 ? int(0, NEW_WITHIN_DAYS) : int(0, 3 * 365);
      if (ageDays <= NEW_WITHIN_DAYS) tags.push('new');

      games.push({
        id: `${provider}-${slugify(title)}`,
        title,
        provider,
        providerName,
        category,
        tags,
        rtp: Math.round((94 + rand() * 4) * 100) / 100,
        minBet,
        maxBet,
        releasedAt: new Date(REFERENCE_DATE - ageDays * DAY - int(0, DAY - 1)).toISOString(),
        // Skewed: a few hits, a long tail.
        popularity: Math.round(10_000 * rand() ** 3) + 1,
        hue: int(0, 359),
      });
    }
  }
  return games;
}
