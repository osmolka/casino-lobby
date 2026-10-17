import { useCallback, useEffect, useMemo, useState } from 'react';
import { CatalogError, fetchCatalog, type CatalogErrorKind } from './api';
import type { Game } from './types';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; kind: CatalogErrorKind }
  | { status: 'ready'; games: Game[] };

export type CatalogResult = CatalogState & { retry: () => void };

/** Loads the catalog once per attempt. The request is aborted on unmount, so StrictMode's double mount is safe. */
export function useCatalog(): CatalogResult {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog({ signal: controller.signal }).then(
      (games) => {
        setState({ status: 'ready', games });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', kind: error instanceof CatalogError ? error.kind : 'network' });
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

  return useMemo(() => ({ ...state, retry }), [state, retry]);
}
