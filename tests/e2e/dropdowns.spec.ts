import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const balance = (page: Page) => page.getByRole('button', { name: /^Balance:/ });
const sort = (page: Page) => page.getByLabel('Sort by');
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Deposit' });
const currency = (page: Page) => dialog(page).getByLabel('Currency');
const language = (page: Page) => page.getByRole('region', { name: 'Settings' }).getByLabel('Language');

/**
 * The control's chevron: the balance button's own svg, or the svg next to a select in its wrapper.
 * Returns the gap from the chevron box to the control's border-box inline-end, and the select's content-box
 * end (where its text is clipped) relative to the chevron's inline-start.
 */
function chevron(control: Locator) {
  return control.evaluate((el) => {
    const svg = el instanceof HTMLSelectElement ? el.parentElement?.querySelector('svg') : el.querySelector('svg');
    if (!svg) throw new Error('no chevron');
    const c = el.getBoundingClientRect();
    const s = svg.getBoundingClientRect();
    const style = getComputedStyle(el);
    const rtl = style.direction === 'rtl';
    const contentEnd = rtl
      ? c.left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft)
      : c.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight);
    return {
      gap: rtl ? s.left - c.left : c.right - s.right,
      // ≥ 0: the text area ends before the chevron starts.
      textClearance: rtl ? contentEnd - s.right : s.left - contentEnd,
      center: { x: s.left + s.width / 2, y: s.top + s.height / 2 },
    };
  });
}

/** Width of the select's longest option label in its own font, and its content-box width. */
function longestOption(select: Locator) {
  return select.evaluate((el) => {
    const s = el as HTMLSelectElement;
    const style = getComputedStyle(s);
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.font = style.font;
    const widest = Math.max(...[...s.options].map((o) => ctx.measureText(o.text).width));
    const content = s.clientWidth - Number.parseFloat(style.paddingInlineStart) - Number.parseFloat(style.paddingInlineEnd);
    return { widest, content };
  });
}

const pageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const width of [1440, 360]) {
  for (const dir of ['ltr', 'rtl'] as const) {
    test(`${width}px ${dir}: the chevron sits at the same inline-end gap on the balance button, Sort, Language and Currency`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await page.evaluate((d) => {
        document.documentElement.dir = d;
      }, dir);
      await expect(balance(page)).toBeVisible();
      const b = await chevron(balance(page));
      const s = await chevron(sort(page));
      expect(s.textClearance, 'sort text vs chevron').toBeGreaterThanOrEqual(0);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

      await page.getByRole('banner').getByRole('button', { name: 'Settings' }).click();
      await expect(language(page)).toBeFocused();
      const l = await chevron(language(page));
      expect(l.textClearance, 'language text vs chevron').toBeGreaterThanOrEqual(0);
      await page.keyboard.press('Escape');

      await page.getByRole('banner').getByRole('button', { name: 'Deposit', exact: true }).click();
      const c = await chevron(currency(page));
      expect(c.textClearance, 'currency text vs chevron').toBeGreaterThanOrEqual(0);
      expect(Math.abs(s.gap - b.gap), `sort ${s.gap} vs balance ${b.gap}`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(c.gap - b.gap), `currency ${c.gap} vs balance ${b.gap}`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(l.gap - b.gap), `language ${l.gap} vs balance ${b.gap}`).toBeLessThanOrEqual(0.5);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test(`${width}px: the longest option fits the Sort select's text area`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const { widest, content } = await longestOption(sort(page));
    expect(widest).toBeLessThanOrEqual(content + 0.5);
  });
}

test('clicking the chevron reaches the select; the keyboard still changes it', async ({ page }) => {
  await page.goto('/');
  const select = sort(page);
  const { center } = await chevron(select);
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, center)).toBe('SELECT');
  await page.mouse.click(center.x, center.y);
  await expect(select).toBeFocused();
  await page.keyboard.press('Escape');

  await select.focus();
  await page.keyboard.press('ArrowDown');
  await expect(select).toHaveValue('new');
  await expect(page).toHaveURL(/[?&]sort=new/);
});
