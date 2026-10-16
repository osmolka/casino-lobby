import { afterEach, describe, expect, it, vi } from 'vitest';
import { storageGet, storageSet } from './storage';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('storage', () => {
  it('reads back a written value', () => {
    storageSet('k', 'v');
    expect(storageGet('k')).toBe('v');
  });

  it('returns null for a missing key', () => {
    expect(storageGet('missing')).toBeNull();
  });

  it('returns null when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(storageGet('k')).toBeNull();
  });

  it('swallows setItem errors (quota, private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => {
      storageSet('k', 'v');
    }).not.toThrow();
  });
});
