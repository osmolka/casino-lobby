import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getSnapshot = () => navigator.onLine;

/** `navigator.onLine`: false means definitely offline; true may still be a captive or broken network. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
