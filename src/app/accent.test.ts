import css from './tokens.css?raw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCENT_HUE_KEY, DEFAULT_ACCENT_HUE, applyHue, parseHue, readStoredHue, resetHue, storeHue } from './accent';

const root = document.documentElement;

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  root.removeAttribute('style');
});

describe('parseHue', () => {
  it.each([
    ['0', 0],
    ['292', 292],
    ['359', 359],
  ])('accepts the whole degree %s', (value, hue) => {
    expect(parseHue(value)).toBe(hue);
  });

  it.each([null, '', '360', '-1', '1.5', '29a', ' 12', '0012', 'NaN', 120])('rejects %j', (value) => {
    expect(parseHue(value)).toBeNull();
  });
});

describe('accent hue', () => {
  it('the default matches --accent-h in tokens.css', () => {
    expect(new RegExp(`--accent-h:\\s*${DEFAULT_ACCENT_HUE}\\s*;`).test(css)).toBe(true);
  });

  it('reads the stored hue, or the default for a missing or invalid value', () => {
    expect(readStoredHue()).toBe(DEFAULT_ACCENT_HUE);
    localStorage.setItem(ACCENT_HUE_KEY, '120');
    expect(readStoredHue()).toBe(120);
    localStorage.setItem(ACCENT_HUE_KEY, '400');
    expect(readStoredHue()).toBe(DEFAULT_ACCENT_HUE);
  });

  it('applies the hue as --accent-h on <html> and stores it', () => {
    applyHue(45);
    storeHue(45);
    expect(root.style.getPropertyValue('--accent-h')).toBe('45');
    expect(localStorage.getItem(ACCENT_HUE_KEY)).toBe('45');
  });

  it('reset drops the inline value and the stored choice, so tokens.css applies again', () => {
    applyHue(45);
    storeHue(45);
    resetHue();
    expect(root.style.getPropertyValue('--accent-h')).toBe('');
    expect(localStorage.getItem(ACCENT_HUE_KEY)).toBeNull();
  });

  it('survives localStorage throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(readStoredHue()).toBe(DEFAULT_ACCENT_HUE);
    expect(() => {
      storeHue(10);
      resetHue();
    }).not.toThrow();
  });
});
