export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio between two hex colors; NaN if either is unparseable. */
export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return NaN;
  const [hi, lo] = [luminance(ra), luminance(rb)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `hsl(h s% l%)` → '#rrggbb'. `h` in degrees (wraps), `s` and `l` in percent. */
export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export interface Oklch {
  l: number;
  c: number;
  /** Degrees; meaningless (powerless) when c ≈ 0. */
  h: number;
}

const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** '#rrggbb' → OKLCH (Björn Ottosson's matrices, as in CSS Color 4). */
export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = (parseHex(hex) ?? [0, 0, 0]).map(toLinear) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

/** OKLCH → '#rrggbb', channels clipped to sRGB. */
export function oklchToHex({ l: L, c, h }: Oklch): string {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, fromLinear(v))) * 255).toString(16).padStart(2, '0')).join('')}`;
}

const POWERLESS = 1e-4;

/**
 * `color-mix(in oklch, a <weight>, b)` on OKLCH values as CSS resolves them (an out-of-gamut side is not clipped
 * first): weight in 0–1; shorter hue arc; an achromatic side takes the other's hue.
 */
export function mixLch(x: Oklch, weight: number, y: Oklch): Oklch {
  const hx = x.c < POWERLESS ? y.h : x.h;
  const hy = y.c < POWERLESS ? x.h : y.h;
  const delta = ((((hy - hx) % 360) + 540) % 360) - 180;
  return {
    l: x.l * weight + y.l * (1 - weight),
    c: x.c * weight + y.c * (1 - weight),
    h: (hx + delta * (1 - weight) + 360) % 360,
  };
}

/** `color-mix(in oklch, a <weight>, b)` of two hex colors, rendered. */
export function mixOklch(a: string, weight: number, b: string): string {
  return oklchToHex(mixLch(hexToOklch(a), weight, hexToOklch(b)));
}

/** `fg` painted at `opacity` over `bg` (e.g. a dimmed button), 8-bit sRGB. */
export function overlay(fg: string, opacity: number, bg: string): string {
  const [f, b] = [parseHex(fg) ?? [0, 0, 0], parseHex(bg) ?? [0, 0, 0]];
  return `#${f.map((c, i) => Math.round(c * opacity + (b[i] ?? 0) * (1 - opacity)).toString(16).padStart(2, '0')).join('')}`;
}

/** `oklch(from <hex> calc(l + shift) c h)`. */
export function shiftLightness(hex: string, shift: number): string {
  const o = hexToOklch(hex);
  return oklchToHex({ ...o, l: Math.min(1, Math.max(0, o.l + shift)) });
}
