import { delay } from '../../shared/delay';
import { getMockFlags } from '../../shared/mockFlags';
import { parsePromos, type Promo } from './promos';

export const PROMOS_URL = `${import.meta.env.BASE_URL}api/promos.json`;

// Slower than the catalog (400–900 ms), so the promo skeleton is visible while the grid is already there.
const MIN_DELAY_MS = 600;
const MAX_DELAY_MS = 1100;
const SLOW_EXTRA_MS = 2500;

export class PromosError extends Error {
  override readonly name = 'PromosError';
}

export interface FetchPromosOptions {
  signal?: AbortSignal;
  /** Defaults to `window.location.search`; read for `?mock=`. */
  search?: string;
  /** Injected for deterministic delays in tests. */
  random?: () => number;
}

/**
 * Loads `api/promos.json` after the artificial delay (`?mock=slow|fail-promos|empty-promos`).
 * Rejects with PromosError, or with the signal's AbortError when aborted (callers should ignore that one).
 */
export async function fetchPromos(options: FetchPromosOptions = {}): Promise<Promo[]> {
  const { signal, search = window.location.search, random = Math.random } = options;
  const mock = getMockFlags(search);

  const ms = MIN_DELAY_MS + Math.floor(random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  await delay(mock.has('slow') ? ms + SLOW_EXTRA_MS : ms, signal);
  if (mock.has('fail-promos')) throw new PromosError('fail-promos');
  if (mock.has('empty-promos')) return [];

  let body: unknown;
  try {
    const response = await fetch(PROMOS_URL, signal ? { signal } : {});
    if (!response.ok) throw new PromosError(`http ${response.status}`);
    body = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw error instanceof PromosError ? error : new PromosError('load', { cause: error });
  }
  const promos = parsePromos(body);
  if (!promos) throw new PromosError('invalid');
  return promos;
}
