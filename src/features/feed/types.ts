export interface FeedGame {
  id: string;
  title: string;
}

export interface Win {
  id: string;
  /** Display name (mock data), e.g. 'Mila K.'. */
  player: string;
  /** Avatar hue, integer 0–359. */
  hue: number;
  gameId: string;
  gameTitle: string;
  /** Integer minor units of WALLET_CURRENCY. */
  amount: number;
  /** ms epoch. */
  at: number;
}

export type PauseReason = 'hover' | 'focus' | 'hidden' | 'user' | 'offline';
