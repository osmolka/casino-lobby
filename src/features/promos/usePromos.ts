import { useCallback, useEffect, useState } from 'react';
import { fetchPromos } from './api';
import type { Promo } from './promos';

export type PromosState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; promos: Promo[] };

/**
 * Loads the promos once per attempt. State stays inside the promos section: nothing else re-renders when it
 * changes. The request is aborted on unmount, so StrictMode's double mount is safe.
 */
export function usePromos(): PromosState & { retry: () => void } {
  const [state, setState] = useState<PromosState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchPromos({ signal: controller.signal }).then(
      (promos) => {
        setState({ status: 'ready', promos });
      },
      () => {
        if (controller.signal.aborted) return;
        setState({ status: 'error' });
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
