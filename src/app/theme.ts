import { storageGet, storageSet } from '../shared/storage';
import { THEME_COLORS } from './themeColors';

export type Theme = 'light' | 'dark';

/** Also read by the inline script in index.html — keep in sync. */
export const THEME_KEY = 'lobby.theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

export function readStoredTheme(): Theme | null {
  const value = storageGet(THEME_KEY);
  return isTheme(value) ? value : null;
}

export function storeTheme(theme: Theme): void {
  storageSet(THEME_KEY, theme);
}

export const DARK_QUERY = '(prefers-color-scheme: dark)';

export function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function resolveTheme(): Theme {
  return readStoredTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  // The one theme-color meta (index.html) follows the manual theme, as the boot script set it on load.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}
