import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { connectFeed } from './api';
import { createFeedStore, type FeedSnapshot, type FeedStore } from './feedStore';

export type FeedState = { status: 'loading' } | { status: 'error' } | { status: 'empty' } | { status: 'ready'; store: FeedStore };

export type FeedResult = FeedState & { retry: () => void };

/** Connects once per attempt; aborted on unmount (StrictMode-safe). A fresh store per successful attempt. */
export function useFeed(): FeedResult {
  const [state, setState] = useState<FeedState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    connectFeed({ signal: controller.signal }).then(
      (games) => {
        // Creating a store has no side effects; its timer starts on the first subscribe.
        setState(games.length === 0 ? { status: 'empty' } : { status: 'ready', store: createFeedStore({ games }) });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      },
    );
    return () => {
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}

/** Subscribes to one slice of the store; re-renders only when that slice's reference changes. */
export function useFeedSlice<K extends keyof FeedSnapshot>(store: FeedStore, key: K): FeedSnapshot[K] {
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot()[key]);
}
