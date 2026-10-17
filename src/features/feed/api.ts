import { delay } from '../../shared/delay';
import { getMockFlags } from '../../shared/mockFlags';
import { loadGames } from '../catalog/api';
import type { FeedGame } from './types';

const MIN_DELAY_MS = 400;
const MAX_DELAY_MS = 900;
const SLOW_EXTRA_MS = 2500;

export class FeedError extends Error {
  override readonly name = 'FeedError';
}

export interface ConnectFeedOptions {
  signal?: AbortSignal;
  /** Defaults to `window.location.search`; read for `?mock=`. */
  search?: string;
  random?: () => number;
}

/**
 * "Connects" to the simulated stream: the game titles to report wins on. Wins are generated client-side
 * (feedStore), so nothing else goes over the network. `?mock=fail-feed` → FeedError, `?mock=empty-feed` → [].
 * Rejects with FeedError, or with the signal's AbortError when aborted.
 */
export async function connectFeed(options: ConnectFeedOptions = {}): Promise<FeedGame[]> {
  const { signal, search = window.location.search, random = Math.random } = options;
  const mock = getMockFlags(search);

  const ms = MIN_DELAY_MS + Math.floor(random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  await delay(mock.has('slow') ? ms + SLOW_EXTRA_MS : ms, signal);
  if (mock.has('fail-feed')) throw new FeedError('fail-feed');
  if (mock.has('empty-feed')) return [];

  try {
    const games = await loadGames(signal);
    return games.map(({ id, title }) => ({ id, title }));
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new FeedError('load', { cause: error });
  }
}
