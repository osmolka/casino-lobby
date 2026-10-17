import css from './tokens.css?raw';
import { describe, expect, it } from 'vitest';
import { contrastRatio, hslToHex } from '../shared/contrast';

function block(selector: string): string {
  const start = css.indexOf(selector);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

function tokens(selector: string): Record<string, string> {
  return Object.fromEntries([...block(selector).matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map((m): [string, string] => [m[1] ?? '', m[2] ?? '']));
}

const TEXT = 4.5;
const UI = 3;
const PAIRS: [fg: string, bg: string, min: number][] = [
  ['fg', 'bg', TEXT],
  ['fg', 'surface', TEXT],
  ['fg-muted', 'bg', TEXT],
  ['fg-muted', 'surface', TEXT],
  ['accent', 'bg', TEXT],
  ['accent', 'surface', TEXT],
  ['accent-fg', 'accent', TEXT],
  ['danger', 'bg', TEXT],
  ['danger', 'surface', TEXT],
  ['success', 'bg', TEXT],
  ['success', 'surface', TEXT],
  ['focus', 'bg', UI],
  ['focus', 'surface', UI],
  ['border', 'bg', UI],
  ['border', 'surface', UI],
];

describe.each(["[data-theme='light']", "[data-theme='dark']"])('tokens %s', (selector) => {
  const t = tokens(selector);

  it.each(PAIRS)('%s on %s ≥ %s:1', (fg, bg, min) => {
    const a = t[fg];
    const b = t[bg];
    expect(a, fg).toBeDefined();
    expect(b, bg).toBeDefined();
    expect(contrastRatio(a ?? '', b ?? '')).toBeGreaterThanOrEqual(min);
  });
});

/** Percentage tokens, e.g. `--avatar-lightness: 85%` → { 'avatar-lightness': 85 }. */
function percents(selector: string): Record<string, number> {
  return Object.fromEntries([...block(selector).matchAll(/--([\w-]+):\s*([\d.]+)%\s*;/g)].map((m): [string, number] => [m[1] ?? '', Number(m[2])]));
}

const HUES = Array.from({ length: 360 }, (_, h) => h);

// Feed avatars: initials in --fg on hsl(<hue> --avatar-saturation --avatar-lightness), hue 0–359 from the win.
describe.each(["[data-theme='light']", "[data-theme='dark']"])('avatar initials %s', (selector) => {
  it(`fg on every hue ≥ ${TEXT}:1`, () => {
    const fg = tokens(selector).fg ?? '';
    const { 'avatar-saturation': s, 'avatar-lightness': l } = percents(selector);
    expect(s, 'avatar-saturation').toBeDefined();
    expect(l, 'avatar-lightness').toBeDefined();
    const failing = HUES.filter((h) => !(contrastRatio(fg, hslToHex(h, s ?? NaN, l ?? NaN)) >= TEXT));
    expect(failing).toEqual([]);
  });
});
