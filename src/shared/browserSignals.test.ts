import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDocumentHidden, isOnline, subscribeOnline, subscribeVisibility } from './browserSignals';

afterEach(() => {
  vi.restoreAllMocks();
});

function setHidden(hidden: boolean) {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(hidden ? 'hidden' : 'visible');
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('subscribeVisibility', () => {
  it('shares one DOM listener between subscribers and removes it after the last one leaves', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeVisibility(a);
    const offB = subscribeVisibility(b);
    expect(add.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1);

    setHidden(true);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    offA();
    expect(remove.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(0);
    offB();
    expect(remove.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1);

    setHidden(false);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('keeps the same callback subscribed twice as two subscriptions; unsubscribe is idempotent', () => {
    const cb = vi.fn();
    const off1 = subscribeVisibility(cb);
    const off2 = subscribeVisibility(cb);
    off1();
    off1();
    setHidden(true);
    expect(cb).toHaveBeenCalledTimes(1);
    off2();
  });

  it('isDocumentHidden reads the current state', () => {
    setHidden(true);
    expect(isDocumentHidden()).toBe(true);
    setHidden(false);
    expect(isDocumentHidden()).toBe(false);
  });
});

describe('subscribeOnline', () => {
  it('notifies on online and offline with one listener per event type', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const cb = vi.fn();
    const other = vi.fn();
    const off = subscribeOnline(cb);
    const offOther = subscribeOnline(other);
    expect(add.mock.calls.map(([type]) => type).filter((t) => t === 'online' || t === 'offline')).toEqual(['online', 'offline']);

    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    offOther();
    window.dispatchEvent(new Event('offline'));
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('isOnline reads navigator.onLine', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(isOnline()).toBe(false);
  });
});
