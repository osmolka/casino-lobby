import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { oklch, samplePixel, stateForcer, type Rgb } from './color';
import { expect, test } from './fixtures';

type Family = 'accent' | 'neutral';
interface Target {
  name: string;
  family: Family;
  get: (page: Page) => Locator;
}

const TARGETS: Target[] = [
  { name: 'Deposit', family: 'accent', get: (p) => p.getByRole('banner').getByRole('button', { name: 'Deposit', exact: true }) },
  { name: 'Search', family: 'neutral', get: (p) => p.getByRole('banner').getByRole('button', { name: 'Search', exact: true }) },
  { name: 'balance', family: 'neutral', get: (p) => p.getByRole('button', { name: /^Balance:/ }) },
  { name: 'chip', family: 'neutral', get: (p) => p.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Slots' }) },
  { name: 'selected chip', family: 'accent', get: (p) => p.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'All' }) },
  { name: 'Pause', family: 'neutral', get: (p) => p.getByRole('button', { name: 'Pause live feed' }) },
  { name: 'promo Next', family: 'neutral', get: (p) => p.getByRole('button', { name: 'Next promotions' }) },
];
const RETRY: Target = {
  name: 'Retry',
  family: 'accent',
  get: (p) => p.getByRole('main').getByRole('alert').getByRole('button', { name: 'Try again' }),
};

/** Outline buttons must look brand-tinted, not gray: OKLCH chroma of the rendered hover/press background. */
const MIN_NEUTRAL_CHROMA = 0.02;

/** The token's computed value, resolved on a probe element the same way the button's background is. */
function tokenColor(page: Page, token: string) {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return value;
  }, token);
}

const rgbOf = (css: string): Rgb => {
  const [r = 0, g = 0, b = 0] = (css.match(/[\d.]+/g) ?? []).map(Number);
  return [r, g, b];
};
const luminance = (rgb: Rgb) =>
  rgb
    .map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, v, i) => sum + v * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

type Forcer = Awaited<ReturnType<typeof stateForcer>>;

async function checkTarget(page: Page, forcer: Forcer, target: Target) {
  const el = target.get(page);
  await expect(el).toBeVisible();
  for (const state of ['hover', 'active'] as const) {
    await forcer.force(el, state === 'hover' ? ['hover'] : ['hover', 'active']);
    const label = `${target.name} :${state}`;
    // Polled: a background-color transition (0.01ms under reduced motion) may still be on its first frame.
    const token = await tokenColor(page, `--${target.family}-${state}`);
    await expect.poll(() => el.evaluate((e) => getComputedStyle(e).backgroundColor), { message: label }).toBe(token);

    const pixel = await samplePixel(page, el);
    if (target.family === 'neutral') expect(oklch(pixel).c, `${label} chroma`).toBeGreaterThan(MIN_NEUTRAL_CHROMA);
    const text = rgbOf(await el.evaluate((e) => getComputedStyle(e).color));
    expect(contrast(text, pixel), `${label} text contrast`).toBeGreaterThanOrEqual(4.5);
    await forcer.clear();
  }
}

async function axeWithHover(page: Page, forcer: Forcer, targets: Target[]) {
  for (const target of targets) await forcer.force(target.get(page), ['hover']);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  await forcer.clear();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: hover/press backgrounds match the family tokens, neutral ones are brand-tinted, text ≥ 4.5:1`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    const forcer = await stateForcer(page);
    for (const target of TARGETS) await checkTarget(page, forcer, target);
    // One target per family hovered at once: axe's color-contrast rule sees the hover backgrounds.
    const hovered = [TARGETS[0], TARGETS[1], TARGETS[3], TARGETS[4]].filter((t) => t !== undefined);
    expect(await axeWithHover(page, forcer, hovered), 'axe').toEqual([]);
    await forcer.detach();

    await page.goto('/?mock=fail-catalog');
    const retryForcer = await stateForcer(page);
    await checkTarget(page, retryForcer, RETRY);
    await retryForcer.detach();
  });
}
