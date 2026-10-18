import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isOnline, subscribeOnline } from '../../shared/browserSignals';
import { CatalogError, fetchCatalog, type CatalogErrorKind } from './api';
import type { Game } from './types';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; kind: CatalogErrorKind }
  | {
      status: 'ready';
      games: Game[];
      /** null: fresh. Otherwise the request failed and these games come from catalog:v1, saved at this time. */
      savedAt: number | null;
      /** Fresh data that replaced an error or a saved catalog: announced once as "Catalog loaded". */
      restored: boolean;
      /** When this result arrived (ms epoch): "today" for the saved time is judged against it. */
      checkedAt: number;
    };

export type CatalogResult = CatalogState & { retry: () => void };

/**
 * Loads the catalog once per attempt. The request is aborted on unmount or when a new attempt starts, so
 * StrictMode's double mount is safe and only one request is ever in flight. After a failure (error or saved
 * catalog) the `online` event starts a new attempt; a saved catalog stays on screen while it loads.
 */
export function useCatalog(): CatalogResult {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Refs, not state: read by the online listener, never rendered.
  const failedRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    inFlightRef.current = true;
    fetchCatalog({ signal: controller.signal }).then(
      ({ games, savedAt }) => {
        inFlightRef.current = false;
        const restored = savedAt === null && failedRef.current;
        failedRef.current = savedAt !== null;
        setState({ status: 'ready', games, savedAt, restored, checkedAt: Date.now() });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        inFlightRef.current = false;
        failedRef.current = true;
        setState({ status: 'error', kind: error instanceof CatalogError ? error.kind : 'network' });
      },
    );
    return () => {
      controller.abort();
      inFlightRef.current = false;
    };
  }, [attempt]);

  // A saved catalog stays visible during the new attempt; anything else shows the skeleton.
  const retry = useCallback(() => {
    inFlightRef.current = true; // until the effect starts: a burst of online events makes one attempt
    setState((s) => (s.status === 'ready' && s.savedAt !== null ? s : { status: 'loading' }));
    setAttempt((n) => n + 1);
  }, []);

  useEffect(
    () =>
      subscribeOnline(() => {
        if (!isOnline()) {
          // "Catalog loaded" was said; coming back online with the same data must not say it again.
          setState((s) => (s.status === 'ready' && s.restored ? { ...s, restored: false } : s));
        } else if (failedRef.current && !inFlightRef.current) retry();
      }),
    [retry],
  );

  return useMemo(() => ({ ...state, retry }), [state, retry]);
}
