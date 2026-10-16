import html from '../../index.html?raw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_KEY } from '../i18n/locales';
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

  it('survives localStorage throwing', () => {
    mockSystemDark(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(runBoot).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
