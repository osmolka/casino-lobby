import html from '../../index.html?raw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALES, LOCALE_KEY } from '../i18n/locales';
import { ACCENT_HUE_KEY } from './accent';
import { THEME_KEY } from './theme';

const script = /<script id="boot">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

function runBoot() {
  // Same code the browser runs before CSS loads.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const boot = new Function(script) as () => void;
  boot();
}

function mockSystemDark(dark: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) => ({ matches: dark && query.includes('dark'), media: query }) as MediaQueryList,
  );
}

beforeEach(() => {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  root.removeAttribute('style');
  root.lang = '';
  root.dir = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('index.html boot script', () => {
  it('is present and uses the same storage keys as the app', () => {
    expect(script).toContain(`'${THEME_KEY}'`);
    expect(script).toContain(`'${LOCALE_KEY}'`);
    expect(script).toContain(`'${ACCENT_HUE_KEY}'`);
  });

  it('applies a stored accent hue as --accent-h before CSS loads', () => {
    mockSystemDark(false);
    localStorage.setItem(ACCENT_HUE_KEY, '120');
    runBoot();
    expect(document.documentElement.style.getPropertyValue('--accent-h')).toBe('120');
  });

  it.each(['360', '-5', '1.5', 'red', '12;color:red'])('ignores an invalid stored hue %j (tokens.css default stays)', (value) => {
    mockSystemDark(false);
    localStorage.setItem(ACCENT_HUE_KEY, value);
    runBoot();
    expect(document.documentElement.style.getPropertyValue('--accent-h')).toBe('');
  });

  it('applies the stored theme before the app mounts', () => {
    mockSystemDark(false);
    localStorage.setItem(THEME_KEY, 'dark');
    runBoot();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('falls back to prefers-color-scheme, then to en/ltr', () => {
    mockSystemDark(true);
    localStorage.setItem(LOCALE_KEY, 'xx');
    runBoot();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('applies a stored ru locale (lang, ltr) before the app mounts', () => {
    mockSystemDark(false);
    localStorage.setItem(LOCALE_KEY, 'ru');
    runBoot();
    expect(document.documentElement.lang).toBe('ru');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('knows exactly the locales of src/i18n/locales.ts', () => {
    const map = /var locales = (\{[^}]*\});/.exec(script)?.[1] ?? '';
    const codes = [...map.matchAll(/(\w+):\s*'(ltr|rtl)'/g)].map((m) => [m[1], m[2]]);
    expect(Object.fromEntries(codes)).toEqual(Object.fromEntries(Object.values(LOCALES).map((l) => [l.code, l.dir])));
  });

  it('survives localStorage throwing', () => {
    mockSystemDark(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(runBoot).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
