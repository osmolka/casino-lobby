export const THUMB_VIEWBOX = { width: 160, height: 120 } as const;

export type ThumbShapeKind = 'circle' | 'ring' | 'diamond';

export interface ThumbShape {
  kind: ThumbShapeKind;
  x: number;
  y: number;
  size: number;
  opacity: number;
}

export interface ThumbnailSpec {
  /** Base hue (the game's `hue`), 0–359. */
  hueA: number;
  /** Second gradient stop, 0–359. */
  hueB: number;
  /** Gradient angle in degrees. */
  angle: number;
  shapes: ThumbShape[];
}

const KINDS: readonly ThumbShapeKind[] = ['circle', 'ring', 'diamond'];

/** FNV-1a, 32-bit. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: deterministic floats in [0, 1). */
function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const normalizeHue = (h: number) => ((Math.round(h) % 360) + 360) % 360;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Decorative thumbnail parameters derived from the game id and hue. Pure and deterministic. */
export function thumbnailSpec(id: string, hue: number): ThumbnailSpec {
  const rand = prng(hash(id));
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const hueA = normalizeHue(hue);
  const count = int(3, 5);
  const shapes: ThumbShape[] = Array.from({ length: count }, () => ({
    kind: KINDS[int(0, KINDS.length - 1)] ?? 'circle',
    x: int(0, THUMB_VIEWBOX.width),
    y: int(0, THUMB_VIEWBOX.height),
    size: int(10, 44),
    opacity: round1(0.15 + rand() * 0.3),
  }));
  return { hueA, hueB: normalizeHue(hueA + int(30, 90)), angle: int(0, 359), shapes };
}
