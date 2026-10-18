import css from '../app/tokens.css?raw';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { LIGHT_PAGE_BACKGROUND, THEME_COLORS } from '../app/themeColors';
import { MANIFEST } from './manifest';

function token(theme: 'light' | 'dark', name: string): string | undefined {
  const start = css.indexOf(`:root[data-theme='${theme}']`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return new RegExp(`--${name}:\\s*(#[0-9a-f]{3,6})\\s*;`, 'i').exec(body)?.[1];
}

describe('theme colors and manifest', () => {
  it('theme-color per theme = the header --surface of that theme', () => {
    expect(THEME_COLORS.light).toBe(token('light', 'surface'));
    expect(THEME_COLORS.dark).toBe(token('dark', 'surface'));
  });

  it('manifest colors come from the default (light) tokens', () => {
    expect(MANIFEST.theme_color).toBe(token('light', 'surface'));
    expect(MANIFEST.background_color).toBe(token('light', 'bg'));
    expect(LIGHT_PAGE_BACKGROUND).toBe(token('light', 'bg'));
  });

  it('names come from the en dictionary (the manifest is static, en)', () => {
    expect(MANIFEST.name).toBe(en.app.title);
    expect(MANIFEST.short_name).toBe(en.app.name);
    expect(MANIFEST.lang).toBe('en');
  });

  it('has the installability basics: standalone, start_url, 192 + 512 + maskable icons', () => {
    expect(MANIFEST).toMatchObject({ display: 'standalone', start_url: '/' });
    expect(MANIFEST.icons.map((i) => [i.sizes, 'purpose' in i ? i.purpose : 'any'])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ]);
  });
});
