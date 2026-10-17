import css from './tokens.css?raw';
import { describe, expect, it } from 'vitest';
import { contrastRatio, hslToHex, parseHex } from '../shared/contrast';

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

// Dropdown chevrons (balance button, every select) are drawn in --fg on the control's background,
// including the hover background (--skeleton): a UI graphic, ≥ 3:1.
describe.each(["[data-theme='light']", "[data-theme='dark']"])('dropdown chevron %s', (selector) => {
  const t = tokens(selector);
  it.each(['bg', 'surface', 'skeleton'])(`fg chevron on %s ≥ ${UI}:1`, (bg) => {
    expect(contrastRatio(t.fg ?? '', t[bg] ?? '')).toBeGreaterThanOrEqual(UI);
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

/** `--promo-hue-shift: 40` → 40 (unitless numbers on :root). */
function number(name: string): number {
  const m = new RegExp(`--${name}:\\s*(-?[\\d.]+)\\s*;`).exec(css);
  return m ? Number(m[1]) : NaN;
}

/** sRGB interpolation of two '#rrggbb' colors (the cards use `linear-gradient(… in srgb, …)`). */
function mix(a: string, b: string, t: number): string {
  const [ra, rb] = [parseHex(a), parseHex(b)];
  if (!ra || !rb) return '';
  return `#${ra.map((c, i) => Math.round(c + ((rb[i] ?? 0) - c) * t).toString(16).padStart(2, '0')).join('')}`;
}

const STOPS = Array.from({ length: 101 }, (_, i) => i / 100);

// Promo cards: --fg text on a gradient from hsl(<hue> s start) to hsl(<hue + shift> s end), hue 0–359 from
// promos.json. Every point of the gradient (101 samples) is checked, so the worst point passes.
describe.each(["[data-theme='light']", "[data-theme='dark']"])('promo gradient text %s', (selector) => {
  it(`fg at every gradient point, every hue ≥ ${TEXT}:1`, () => {
    const fg = tokens(selector).fg ?? '';
    const shift = number('promo-hue-shift');
    const { 'promo-saturation': s, 'promo-lightness-start': l1, 'promo-lightness-end': l2 } = percents(selector);
    expect(shift, 'promo-hue-shift').not.toBeNaN();
    for (const [name, value] of [['saturation', s], ['lightness-start', l1], ['lightness-end', l2]] as const) {
      expect(value, `promo-${name}`).toBeDefined();
    }
    const failing = HUES.filter((h) => {
      const start = hslToHex(h, s ?? NaN, l1 ?? NaN);
      const end = hslToHex((h + shift) % 360, s ?? NaN, l2 ?? NaN);
      return !STOPS.every((t) => contrastRatio(fg, mix(start, end, t)) >= TEXT);
    });
    expect(failing).toEqual([]);
  });
});
