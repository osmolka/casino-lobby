/// <reference types="node" />
// DepositForm.module.css via Node: Vitest stubs `?raw` CSS imports except tokens.css (vite.config.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import css from './tokens.css?raw';
import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToOklch, hslToHex, mixLch, oklchToHex, overlay, parseHex, type Oklch } from '../shared/contrast';

function block(selector: string): string {
  const start = css.indexOf(selector);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

function tokens(selector: string): Record<string, string> {
  return Object.fromEntries([...block(selector).matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map((m): [string, string] => [m[1] ?? '', m[2] ?? '']));
}

const depositCss = readFileSync(join(process.cwd(), 'src/features/wallet/DepositForm.module.css'), 'utf8');

const TEXT = 4.5;
const UI = 3;
const PAIRS: [fg: string, bg: string, min: number][] = [
  ['fg', 'bg', TEXT],
  ['fg', 'surface', TEXT],
  ['fg-muted', 'bg', TEXT],
  ['fg-muted', 'surface', TEXT],
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

/** A factor from the generic :root block, e.g. `--neutral-hover: color-mix(in oklch, var(--accent) 12%, …)` → 0.12. */
function mixWeight(name: string): number {
  const m = new RegExp(`--${name}:\\s*color-mix\\(in oklch, var\\(--accent\\) ([\\d.]+)%, var\\(--surface\\)\\)`).exec(css);
  return m ? Number(m[1]) / 100 : NaN;
}
/** `--accent-active: oklch(from var(--accent) calc(l + 1.8 * var(--accent-shift)) c h)` → 1.8 (1 without a factor). */
function shiftFactor(name: string): number {
  const m = new RegExp(`--${name}:\\s*oklch\\(from var\\(--accent\\) calc\\(l \\+ (?:([\\d.]+) \\* )?var\\(--accent-shift\\)\\) c h\\)`).exec(css);
  return m ? Number(m[1] ?? 1) : NaN;
}
/** A unitless number token inside one theme block, e.g. `--accent-l: 0.44;`. */
function themeNumber(selector: string, name: string): number {
  return Number(new RegExp(`--${name}:\\s*(-?[\\d.]+)\\s*;`).exec(block(selector))?.[1]);
}
/** The rules inside `@supports not (<condition>…) { … }`, unwrapped. */
function supportsNot(condition: string): string {
  const at = css.indexOf(`@supports not (${condition}`);
  if (at < 0) return '';
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return '';
}

/*
 * H4 dynamic accent: --accent = oklch(--accent-l --accent-c --accent-h) with L and C fixed per theme, hue 0–359 from
 * the settings slider. Out-of-gamut hues are rendered clipped per channel (Chromium; pinned in contrast.test.ts), so
 * every color below is derived in OKLCH from the unclipped accent, the way CSS resolves it, and clipped only at the
 * end. Every pair is checked at every hue, in both themes, for each @supports branch.
 */
type Branch = 'native' | 'no oklch(from)' | 'no color-mix';
type Role = 'accent' | 'accent-hover' | 'accent-active' | 'neutral-hover' | 'neutral-active';

const THEMES = [
  ["[data-theme='light']", 'black', '#000000'],
  ["[data-theme='dark']", 'white', '#ffffff'],
] as const;
const BRANCHES: Branch[] = ['native', 'no oklch(from)', 'no color-mix'];

const TEXT_ON: [fg: 'accent-fg' | 'accent' | 'fg' | 'fg-muted', bg: Role | 'bg' | 'surface'][] = [
  ['accent-fg', 'accent'],
  ['accent-fg', 'accent-hover'],
  ['accent-fg', 'accent-active'],
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['accent', 'neutral-hover'],
  ['accent', 'neutral-active'],
  ['fg', 'neutral-hover'],
  ['fg', 'neutral-active'],
  ['fg-muted', 'neutral-hover'],
  ['fg-muted', 'neutral-active'],
];
/** A selected chip (accent family) next to a hovered/pressed unselected one (neutral family). */
const CHIP_PAIRS: [selected: Role, unselected: Role][] = [
  ['accent', 'neutral-hover'],
  ['accent', 'neutral-active'],
  ['accent-hover', 'neutral-hover'],
  ['accent-active', 'neutral-active'],
];

describe('accent tokens', () => {
  it('derive --accent from --accent-l/-c per theme and one --accent-h', () => {
    expect(css).toMatch(/--accent:\s*oklch\(var\(--accent-l\) var\(--accent-c\) var\(--accent-h\)\);/);
    expect(number('accent-h')).toBeGreaterThanOrEqual(0);
    for (const [selector] of THEMES) {
      expect(themeNumber(selector, 'accent-l'), selector).toBeGreaterThan(0);
      expect(themeNumber(selector, 'accent-c'), selector).toBeGreaterThan(0);
    }
  });
});

describe.each(THEMES)('accent at every hue %s', (selector, keyword, target) => {
  const t = tokens(selector);
  const L = themeNumber(selector, 'accent-l');
  const C = themeNumber(selector, 'accent-c');
  const shift = themeNumber(selector, 'accent-shift');
  const surface = hexToOklch(t.surface ?? '');
  const towards = hexToOklch(target);
  const fallback = supportsNot('color: oklch(from');
  const fallbackWeight = (name: string) => {
    const m = new RegExp(`--${name}: color-mix\\(in oklch, var\\(--accent\\) ([\\d.]+)%, ${keyword}\\)`).exec(
      fallback.slice(fallback.indexOf(selector)),
    );
    return m ? Number(m[1]) / 100 : NaN;
  };

  function colors(branch: Branch, h: number): Record<Role | 'bg' | 'surface' | 'fg' | 'fg-muted' | 'accent-fg', string> {
    const accent: Oklch = { l: L, c: C, h };
    const states: Record<Role, Oklch> =
      branch === 'native'
        ? {
            accent,
            'accent-hover': { ...accent, l: L + shiftFactor('accent-hover') * shift },
            'accent-active': { ...accent, l: L + shiftFactor('accent-active') * shift },
            'neutral-hover': mixLch(accent, mixWeight('neutral-hover'), surface),
            'neutral-active': mixLch(accent, mixWeight('neutral-active'), surface),
          }
        : branch === 'no oklch(from)'
          ? {
              accent,
              'accent-hover': mixLch(accent, fallbackWeight('accent-hover'), towards),
              'accent-active': mixLch(accent, fallbackWeight('accent-active'), towards),
              'neutral-hover': mixLch(accent, mixWeight('neutral-hover'), surface),
              'neutral-active': mixLch(accent, mixWeight('neutral-active'), surface),
            }
          : { accent, 'accent-hover': accent, 'accent-active': accent, 'neutral-hover': surface, 'neutral-active': surface };
    const rendered = Object.fromEntries(Object.entries(states).map(([role, o]) => [role, oklchToHex(o)])) as Record<Role, string>;
    return { ...rendered, bg: t.bg ?? '', surface: t.surface ?? '', fg: t.fg ?? '', 'fg-muted': t['fg-muted'] ?? '', 'accent-fg': t['accent-fg'] ?? '' };
  }

  /** `name@hue ratio` for every hue where the pair is below `min`. */
  function failing(branch: Branch, ratio: (c: ReturnType<typeof colors>) => number, min: number): string[] {
    return HUES.flatMap((h) => {
      const r = ratio(colors(branch, h));
      return r >= min ? [] : [`@${h}: ${r.toFixed(2)}`];
    });
  }

  it('parses L, C, shift, the mix weights and the fallback weights', () => {
    for (const [name, value] of Object.entries({ L, C, shift, fh: fallbackWeight('accent-hover'), fa: fallbackWeight('accent-active') })) {
      expect(value, name).not.toBeNaN();
    }
    expect(mixWeight('neutral-hover')).not.toBeNaN();
    expect(mixWeight('neutral-active')).not.toBeNaN();
    expect(Math.sign(shift), 'accent states step away from the accent (darker in light, lighter in dark)').toBe(
      selector.includes('dark') ? 1 : -1,
    );
  });

  describe.each(BRANCHES)('%s', (branch) => {
    it.each(TEXT_ON)(`%s on %s ≥ ${TEXT}:1 at hue 0–359`, (fg, bg) => {
      expect(failing(branch, (c) => contrastRatio(c[fg], c[bg]), TEXT)).toEqual([]);
    });

    // Without color-mix the unselected states are plain --surface: covered by accent on surface above.
    if (branch === 'no color-mix') return;
    it.each(CHIP_PAIRS)(`selected chip %s vs unselected %s ≥ ${UI}:1 at hue 0–359`, (a, b) => {
      expect(failing(branch, (c) => contrastRatio(c[a], c[b]), UI)).toEqual([]);
    });
  });

  // Deposit Confirm while offline or in flight: aria-disabled, dimmed with opacity on the dialog's --surface.
  // Inactive controls are exempt from 1.4.3/1.4.11, but the dimmed button must still read as a button.
  it(`dimmed Confirm (aria-disabled) fill vs the dialog surface ≥ ${UI}:1 at hue 0–359`, () => {
    const opacity = Number(/\.primary\[aria-disabled='true'\]\s*\{[^}]*opacity:\s*([\d.]+)/.exec(depositCss)?.[1]);
    expect(opacity).toBeGreaterThan(0);
    expect(failing('native', (c) => contrastRatio(overlay(c.accent, opacity, c.surface), c.surface), UI)).toEqual([]);
  });

  it('the oklch(from …) fallback takes the same lightness step as the native tokens (±0.01)', () => {
    const accent: Oklch = { l: L, c: C, h: 0 };
    expect(Math.abs(mixLch(accent, fallbackWeight('accent-hover'), towards).l - L - shift)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(mixLch(accent, fallbackWeight('accent-active'), towards).l - L - shiftFactor('accent-active') * shift)).toBeLessThanOrEqual(0.01);
  });

  // Browsers without oklch() at all get a fixed hex accent (the default hue, rendered) and no hue control.
  it('without oklch(): a hex accent equal to the default hue, AA with accent-fg, bg and surface', () => {
    const noOklch = supportsNot('color: oklch(0 0 0)');
    const hex = new RegExp(`${selector.replace(/[[\]]/g, '\\$&')}[^{]*\\{[^}]*--accent:\\s*(#[0-9a-f]{6})`).exec(noOklch)?.[1] ?? '';
    expect(hex).toBe(oklchToHex({ l: L, c: C, h: number('accent-h') }));
    expect(contrastRatio(t['accent-fg'] ?? '', hex)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(hex, t.bg ?? '')).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(hex, t.surface ?? '')).toBeGreaterThanOrEqual(TEXT);
  });
});
