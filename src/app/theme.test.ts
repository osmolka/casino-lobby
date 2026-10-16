import { afterEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY, applyTheme, readStoredTheme, resolveTheme, storeTheme } from './theme';

function mockSystemDark(dark: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) => ({ matches: dark && query.includes('dark'), media: query }) as MediaQueryList,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('theme', () => {
  it('stored choice wins over the system preference', () => {
    mockSystemDark(true);
    localStorage.setItem(THEME_KEY, 'light');
    expect(resolveTheme()).toBe('light');
  });

  it('falls back to prefers-color-scheme when nothing is stored', () => {
    mockSystemDark(true);
    expect(resolveTheme()).toBe('dark');
    mockSystemDark(false);
    expect(resolveTheme()).toBe('light');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(THEME_KEY, 'purple');
    expect(readStoredTheme()).toBeNull();
  });

  it('falls back to the system theme when localStorage throws', () => {
    mockSystemDark(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(resolveTheme()).toBe('dark');
  });

  it('persists the choice', () => {
    storeTheme('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('applies data-theme and color-scheme to <html>', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
