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

/** Rendered color 4px inside the inline-start edge at mid height (padding area, no text or icon). */
export async function samplePixel(page: Page, el: Locator): Promise<Rgb> {
  const png = (await el.screenshot({ animations: 'disabled' })).toString('base64');
  return page.evaluate(async (data) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0);
    const [r = 0, g = 0, b = 0] = ctx.getImageData(4, Math.floor(img.height / 2), 1, 1).data;
    return [r, g, b] as [number, number, number];
  }, png);
}
