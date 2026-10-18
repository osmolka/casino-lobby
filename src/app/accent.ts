import { storageGet, storageRemove, storageSet } from '../shared/storage';

/** Also read by the inline script in index.html — keep in sync. */
export const ACCENT_HUE_KEY = 'lobby.accent-hue';

/** Same as `--accent-h` in tokens.css (accent.test.ts checks it). */
export const DEFAULT_ACCENT_HUE = 292;

/** A stored hue: a whole degree 0–359 written as plain digits (360 is 0), else null. Same rule as the boot script. */
export function parseHue(value: unknown): number | null {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,2})$/.test(value)) return null;
  const hue = Number(value);
  return hue < 360 ? hue : null;
}

export function readStoredHue(): number {
  return parseHue(storageGet(ACCENT_HUE_KEY)) ?? DEFAULT_ACCENT_HUE;
}

export function storeHue(hue: number): void {
  storageSet(ACCENT_HUE_KEY, String(hue));
}

/** Only the CSS variable changes: every accent token in tokens.css derives from it. */
export function applyHue(hue: number, root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--accent-h', String(hue));
}

export function resetHue(root: HTMLElement = document.documentElement): void {
  root.style.removeProperty('--accent-h');
  storageRemove(ACCENT_HUE_KEY);
}
