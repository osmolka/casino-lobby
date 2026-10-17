import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

interface ScrollCall {
  id: string;
  arg: unknown;
}

declare global {
  interface Window {
    __scrolls: ScrollCall[];
  }
}

/** Records every scrollIntoView call (target id + options), then calls the real one. */
async function recordScrolls(page: Page) {
  await page.addInitScript(() => {
    window.__scrolls = [];
    // Wrapped and re-called with the element as `this`.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element, arg?: boolean | ScrollIntoViewOptions) {
      window.__scrolls.push({ id: this.id, arg });
      original.call(this, arg);
    };
  });
}

const lastCardScroll = (page: Page) =>
  page.evaluate(() => window.__scrolls.filter((s) => s.id.startsWith('game-')).at(-1) ?? null);

async function ready(page: Page) {
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  await expect(page.locator('main [role=status]')).not.toHaveText('');
}

const palette = (page: Page) => page.getByRole('dialog', { name: 'Search and commands' });
const combobox = (page: Page) => palette(page).getByRole('combobox', { name: 'Search games, providers and actions' });
const trigger = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Search', exact: true });

/** Card top vs. the sticky header's bottom and the scroll margin (header block size + space-4 = 80px). */
function cardPosition(page: Page, id: string) {
  return page.evaluate((cardId) => {
    const card = document.getElementById(cardId);
    const header = document.querySelector('header');
    if (!card || !header) throw new Error('missing card or header');
    return {
      top: Math.round(card.getBoundingClientRect().top),
      headerBottom: Math.round(header.getBoundingClientRect().bottom),
      margin: Math.round(Number.parseFloat(getComputedStyle(card).scrollMarginBlockStart)),
    };
  }, id);
}

async function gameId(page: Page, title: string) {
  const id = await page.locator('main a[href^="#game-"]', { hasText: title }).first().getAttribute('id');
  if (!id) throw new Error(`no card for ${title}`);
  return id;
}

test.describe('command palette (keyboard only)', () => {
  test.beforeEach(async ({ page }) => {
    await recordScrolls(page);
  });

  test('Ctrl+K → abbreviation → Enter: the card is focused, below the sticky header, scrolled instantly under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await ready(page);
    const id = await gameId(page, 'Frozen Vault XL');

    await page.keyboard.press('Control+k');
    await expect(combobox(page)).toBeFocused();
    await page.keyboard.type('frz vlt');
    await expect(palette(page).getByRole('option').first()).toHaveText('Frozen Vault XLBlackfin Gaming');
    await page.keyboard.press('Enter');

    await expect(palette(page)).toBeHidden();
    const card = page.locator(`#${id}`);
    await expect(card).toBeFocused();
    expect(await lastCardScroll(page)).toEqual({ id, arg: { block: 'start', behavior: 'auto' } });
    const pos = await cardPosition(page, id);
    expect(pos.margin).toBe(80);
    expect(pos.top).toBeGreaterThanOrEqual(pos.headerBottom);
    expect(Math.abs(pos.top - pos.margin)).toBeLessThanOrEqual(1);

    // Nothing steals focus later (Dialog focus return, debounce, re-renders).
    await page.waitForTimeout(500);
    await expect(card).toBeFocused();
    expect(page.url()).not.toContain('?');
  });

  test('motion allowed: smooth scroll that settles at the scroll margin', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await ready(page);
    const id = await gameId(page, 'Frozen Vault XL');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('frz vlt');
    await page.keyboard.press('Enter');
    await expect(page.locator(`#${id}`)).toBeFocused();
    expect(await lastCardScroll(page)).toEqual({ id, arg: { block: 'start', behavior: 'smooth' } });
    await expect.poll(async () => (await cardPosition(page, id)).top).toBe(80);
  });

  test('a hidden game: one history entry with q = title (sort kept); Back restores the previous filters', async ({ page }) => {
    await page.goto('/?cat=live&sort=rtp');
    await ready(page);
    const entries = await page.evaluate(() => history.length);
    await page.keyboard.press('Control+k');
    await page.keyboard.type('frz vlt');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\?q=Frozen%20Vault%20XL&sort=rtp$/);
    expect(await page.evaluate(() => history.length)).toBe(entries + 1);
    await expect(page.getByRole('searchbox', { name: 'Search games' })).toHaveValue('Frozen Vault XL');
    const card = page.locator('main a[href^="#game-"]', { hasText: 'Frozen Vault XL' });
    await expect(card).toBeFocused();

    await page.goBack();
    await expect(page).toHaveURL(/\?cat=live&sort=rtp$/);
    await expect(page.getByRole('searchbox', { name: 'Search games' })).toHaveValue('');
    await expect(card).toHaveCount(0);
  });

  test('arrows, Home/End and Esc; focus returns to the element that had it', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await trigger(page).focus();
    await page.keyboard.press('Enter');
    await expect(combobox(page)).toBeFocused();
    const options = palette(page).getByRole('option');
    const count = await options.count();
    await page.keyboard.press('End');
    await expect(options.nth(count - 1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(options.nth(count - 1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    // Tab stays inside the dialog.
    await page.keyboard.press('Tab');
    await expect(palette(page).getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(combobox(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(palette(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
  });

  test('deposit action: palette closes, deposit dialog opens alone; after Esc focus is on the trigger, not body', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await expect(page.getByRole('button', { name: /^Balance:/ })).toBeVisible();
    await page.keyboard.press('Control+k');
    await page.keyboard.type('deposit');
    await page.keyboard.press('Enter');
    const deposit = page.getByRole('dialog', { name: 'Deposit' });
    await expect(deposit).toBeVisible();
    await expect(palette(page)).toBeHidden();
    expect(await page.locator('dialog[open]').count()).toBe(1);
    await expect(deposit.getByLabel('Amount')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(deposit).toBeHidden();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
    await expect(trigger(page)).toBeFocused();
  });
});
