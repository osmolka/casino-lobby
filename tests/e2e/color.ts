import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';

export type Rgb = [number, number, number];

/** sRGB 0–255 → OKLCH (l 0–1, c, h in degrees). */
export function oklch([r, g, b]: Rgb) {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

export const hex = (rgb: Rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** 'rgb(1, 2, 3)', '#010203' or '#123' → [r, g, b]. */
export function rgbOf(css: string): Rgb {
  const short = /^#([0-9a-f]{3})$/i.exec(css.trim())?.[1];
  const h = short ? short.replace(/./g, '$&$&') : /^#([0-9a-f]{6})$/i.exec(css.trim())?.[1];
  if (h) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
  const [r = 0, g = 0, b = 0] = (css.match(/[\d.]+/g) ?? []).map(Number);
  return [r, g, b];
}

const luminance = (rgb: Rgb) =>
  rgb
    .map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, v, i) => sum + v * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);

/** WCAG 2.x contrast ratio. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The rules inside `@supports not (<condition>…) { … }` in tokens.css, unwrapped (to emulate a browser without it). */
export function fallbackRules(condition: string): string {
  const css = readFileSync(join(process.cwd(), 'src/app/tokens.css'), 'utf8');
  const at = css.indexOf(`@supports not (${condition}`);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`no @supports not (${condition}…) block`);
}

/**
 * Forces :hover / :active on elements through one CDP session per page, like DevTools' state toggles.
 * One session: detaching a session clears its forced states, which raced with a newer session's.
 */
export async function stateForcer(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  // Once: every DOM.getDocument call invalidates the node ids handed out before it.
  const { root } = await cdp.send('DOM.getDocument');
  const forced = new Set<number>();
  return {
    async force(el: Locator, states: ('hover' | 'active')[]) {
      await el.evaluate((e) => {
        e.setAttribute('data-force-state', '');
      });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-force-state]' });
      await el.evaluate((e) => {
        e.removeAttribute('data-force-state');
      });
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: states });
      forced.add(nodeId);
    },
    async clear() {
      for (const nodeId of forced) await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      forced.clear();
    },
    detach: () => cdp.detach(),
  };
}

/** Rendered colors of an element's screenshot at the given pixel points (CSS px at device scale factor 1). */
export async function samplePixels(page: Page, el: Locator, points: [x: number, y: number][]): Promise<Rgb[]> {
  const png = (await el.screenshot({ animations: 'disabled' })).toString('base64');
  return page.evaluate(
    async ([data, at]) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
      return at.map(([x, y]) => {
        const i = (y * img.width + x) * 4;
        return [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0] as [number, number, number];
      });
    },
    [png, points] as const,
  );
}

/** Rendered color 4px inside the inline-start edge at mid height (padding area, no text or icon). */
export async function samplePixel(page: Page, el: Locator): Promise<Rgb> {
  const box = await el.boundingBox();
  const [rgb] = await samplePixels(page, el, [[4, Math.floor((box?.height ?? 0) / 2)]]);
  return rgb ?? [0, 0, 0];
}
