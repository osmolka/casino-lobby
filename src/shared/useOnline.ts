import { useSyncExternalStore } from 'react';
import { isOnline, subscribeOnline } from './browserSignals';

/** `navigator.onLine`: false means definitely offline; true may still be a captive or broken network. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, isOnline);
}
