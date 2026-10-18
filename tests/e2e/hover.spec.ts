import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { contrast, fallbackRules, oklch, rgbOf, samplePixel, stateForcer } from './color';
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

type Forcer = Awaited<ReturnType<typeof stateForcer>>;

async function checkTarget(page: Page, forcer: Forcer, target: Target, { chroma = true } = {}) {
  const el = target.get(page);
  await expect(el).toBeVisible();
  for (const state of ['hover', 'active'] as const) {
    await forcer.force(el, state === 'hover' ? ['hover'] : ['hover', 'active']);
    const label = `${target.name} :${state}`;
    // Polled: a background-color transition (0.01ms under reduced motion) may still be on its first frame.
    const token = await tokenColor(page, `--${target.family}-${state}`);
    await expect.poll(() => el.evaluate((e) => getComputedStyle(e).backgroundColor), { message: label }).toBe(token);

    const pixel = await samplePixel(page, el);
    if (chroma && target.family === 'neutral') expect(oklch(pixel).c, `${label} chroma`).toBeGreaterThan(MIN_NEUTRAL_CHROMA);
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

    // No saved catalog (the first visit wrote catalog:v1), so fail-catalog shows the error state, not the copy.
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto('/?mock=fail-catalog');
    const retryForcer = await stateForcer(page);
    await checkTarget(page, retryForcer, RETRY);
    await retryForcer.detach();
  });
}

// Chromium supports both features, so the @supports branches never apply here. Injecting their rules
// unwrapped shows what a browser without the feature gets: hover still works and text stays readable.
for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: fallbacks without oklch(from …) and without color-mix keep hover working`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    const forcer = await stateForcer(page);
    const accentTargets = TARGETS.filter((t) => t.family === 'accent');
    const search = TARGETS.find((t) => t.name === 'Search');

    const declared = (name: string) =>
      page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
    expect(await declared('--accent-hover')).toMatch(/^oklch\(from /);

    const noRelative = await page.addStyleTag({ content: fallbackRules('color: oklch(from') });
    // Computed custom properties have var() substituted: color-mix(in oklch, oklch(0.44 0.19 292) 86%, black).
    expect(await declared('--accent-hover')).toMatch(/^color-mix\(in oklch, oklch\([\d. ]+\) \d+%, (black|white)\)$/);
    expect(await declared('--accent-active')).toMatch(/^color-mix\(/);
    for (const target of accentTargets) await checkTarget(page, forcer, target);
    await noRelative.evaluate((style) => {
      (style as ChildNode).remove();
    });

    await page.addStyleTag({ content: fallbackRules('color: color-mix(') });
    expect(await declared('--accent-hover')).toBe(await declared('--accent'));
    expect(await declared('--neutral-hover')).toBe(await declared('--surface'));
    for (const target of [...accentTargets, ...(search ? [search] : [])]) {
      await checkTarget(page, forcer, target, { chroma: false });
    }
    await forcer.detach();
  });
}
