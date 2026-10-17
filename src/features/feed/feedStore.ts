import { isDocumentHidden, isOnline, subscribeOnline, subscribeVisibility } from '../../shared/browserSignals';
import { makeWin, nextDelay, seedWins } from './generator';
import { pushCapped } from './ring';
import type { FeedGame, PauseReason, Win } from './types';

export const BUFFER_SIZE = 50;
export const SEED_COUNT = 8;

export interface FeedSnapshot {
  /** Newest first, at most BUFFER_SIZE. */
  wins: readonly Win[];
  /** The feed generates only while this is empty. */
  reasons: ReadonlySet<PauseReason>;
}

export interface FeedStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => FeedSnapshot;
  pause: (reason: PauseReason) => void;
  resume: (reason: PauseReason) => void;
}

export interface FeedStoreOptions {
  games: readonly FeedGame[];
  random?: () => number;
  now?: () => number;
  /** Past wins shown on connect. */
  seed?: number;
}

/**
 * Simulated win stream for useSyncExternalStore. Creating it has no side effects: the timer and the
 * document/window listeners exist only while there are subscribers (StrictMode-safe). One pending timeout
 * at most; a pause clears it and a resume starts a fresh delay, so nothing piles up while paused.
 */
export function createFeedStore({ games, random = Math.random, now = Date.now, seed = SEED_COUNT }: FeedStoreOptions): FeedStore {
  let snapshot: FeedSnapshot = { wins: seedWins(random, games, now(), seed), reasons: new Set() };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  let detach: (() => void) | null = null;

  const emit = () => {
    for (const listener of [...listeners]) listener();
  };

  const setReason = (reason: PauseReason, on: boolean) => {
    if (snapshot.reasons.has(reason) === on) return false;
    const reasons = new Set(snapshot.reasons);
    if (on) reasons.add(reason);
    else reasons.delete(reason);
    snapshot = { ...snapshot, reasons };
    return true;
  };

  const stop = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const schedule = () => {
    if (timer !== null || listeners.size === 0 || snapshot.reasons.size > 0 || games.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      seq += 1;
      snapshot = { ...snapshot, wins: pushCapped(snapshot.wins, makeWin(random, games, now(), seq), BUFFER_SIZE) };
      emit();
      schedule();
    }, nextDelay(random));
  };

  const update = (reason: PauseReason, on: boolean) => {
    if (!setReason(reason, on)) return;
    if (on) stop();
    emit();
    schedule();
  };

  const syncHidden = () => {
    update('hidden', isDocumentHidden());
  };
  const syncOnline = () => {
    update('offline', !isOnline());
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (!detach) {
        const offVisibility = subscribeVisibility(syncHidden);
        const offOnline = subscribeOnline(syncOnline);
        detach = () => {
          offVisibility();
          offOnline();
        };
        // State at subscribe time: the tab may already be hidden or offline.
        setReason('hidden', isDocumentHidden());
        setReason('offline', !isOnline());
      }
      schedule();
      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        stop();
        detach?.();
        detach = null;
        // Re-read on the next subscribe; nobody is listening to changes until then.
        setReason('hidden', false);
        setReason('offline', false);
      };
    },
    getSnapshot: () => snapshot,
    pause: (reason) => {
      update(reason, true);
    },
    resume: (reason) => {
      update(reason, false);
    },
  };
}
