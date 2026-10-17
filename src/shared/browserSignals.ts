type Listener = () => void;

/**
 * One DOM listener per signal, shared by every subscriber; attached on the first subscribe and removed
 * after the last unsubscribe. Each call returns its own idempotent unsubscribe.
 */
function sharedSignal(target: () => EventTarget, events: readonly string[]): (listener: Listener) => () => void {
  const entries = new Set<{ listener: Listener }>();
  const notify = () => {
    for (const entry of [...entries]) entry.listener();
  };
  return (listener) => {
    if (entries.size === 0) for (const type of events) target().addEventListener(type, notify);
    const entry = { listener };
    entries.add(entry);
    return () => {
      if (!entries.delete(entry) || entries.size > 0) return;
      for (const type of events) target().removeEventListener(type, notify);
    };
  };
}

/** `visibilitychange` on document. Read the current state with `isDocumentHidden()`. */
export const subscribeVisibility = sharedSignal(() => document, ['visibilitychange']);
export const isDocumentHidden = (): boolean => document.hidden;

/** `online`/`offline` on window. `navigator.onLine` false means definitely offline; true may still be a broken network. */
export const subscribeOnline = sharedSignal(() => window, ['online', 'offline']);
export const isOnline = (): boolean => navigator.onLine;
