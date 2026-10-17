import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => {
    mql.removeEventListener('change', onChange);
  };
}

export const prefersReducedMotion = () => window.matchMedia(QUERY).matches;

const getSnapshot = prefersReducedMotion;

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
