import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Fake time via page.clock: install before navigation so the page loads with time flowing, then pause and
// drive it with runFor (fires every timer and frame due in that span). No real waits for feed ticks.
const MAX_TICK_MS = 3000;

const panel = (page: Page) => page.getByRole('complementary', { name: 'Live wins' });
const list = (page: Page) => panel(page).getByRole('list', { name: 'Recent wins' });
const rows = (page: Page) => list(page).getByRole('listitem');
const pauseButton = (page: Page) => panel(page).getByRole('button', { name: /^(Pause|Resume) live feed$/ });

const T0 = new Date('2026-10-17T12:00:00Z').getTime();

/** Loads with time flowing from T0, then pauses at T0 + 10 s (a fixed target, so never in the past). */
async function openPaused(page: Page) {
  await page.clock.install({ time: T0 });
  await page.goto('/');
  await expect(rows(page)).not.toHaveCount(0);
  await page.clock.pauseAt(T0 + 10_000);
}

/** Runs fake time and returns how many wins arrived. */
async function arrivedDuring(page: Page, ms: number): Promise<number> {
  const before = await rows(page).count();
  await page.clock.runFor(ms);
  return (await rows(page).count()) - before;
}

test('wins stream in; after 5 minutes the buffer holds exactly 50', async ({ page }) => {
  await openPaused(page);
  expect(await arrivedDuring(page, 10 * MAX_TICK_MS)).toBeGreaterThanOrEqual(10);
  await page.clock.runFor('05:00');
  await expect(rows(page)).toHaveCount(50);
  await expect(rows(page).first()).toContainText('just now');
});

test('Pause button stops the feed; Resume (pointer and focus on the button) runs it again', async ({ page }) => {
  await openPaused(page);
  await pauseButton(page).click();
  await expect(pauseButton(page)).toHaveText('Resume live feed');
  expect(await arrivedDuring(page, 60_000)).toBe(0);

  await pauseButton(page).click(); // the pointer is over the button, focus is on it
  await expect(pauseButton(page)).toHaveText('Pause live feed');
  expect(await arrivedDuring(page, MAX_TICK_MS)).toBeGreaterThanOrEqual(1);
});

test('mouse hover on the list pauses; moving away resumes', async ({ page }) => {
  await openPaused(page);
  await list(page).hover();
  await expect(panel(page).getByText('Paused while you read')).toBeVisible();
  expect(await arrivedDuring(page, 60_000)).toBe(0);

  await page.mouse.move(0, 0);
  expect(await arrivedDuring(page, MAX_TICK_MS)).toBeGreaterThanOrEqual(1);
});

test('keyboard focus on the list pauses; tabbing away resumes', async ({ page }) => {
  await openPaused(page);
  await pauseButton(page).focus();
  await page.keyboard.press('Tab');
  await expect(list(page)).toBeFocused();
  expect(await arrivedDuring(page, 60_000)).toBe(0);

  await page.keyboard.press('Shift+Tab');
  await expect(pauseButton(page)).toBeFocused();
  expect(await arrivedDuring(page, MAX_TICK_MS)).toBeGreaterThanOrEqual(1);
});

test('hidden tab pauses; visible again resumes', async ({ page }) => {
  await openPaused(page);
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  expect(await arrivedDuring(page, 60_000)).toBe(0);
  await setHidden(false);
  expect(await arrivedDuring(page, MAX_TICK_MS)).toBeGreaterThanOrEqual(1);
});

test('?mock=fail-feed: error, Try again focuses the panel heading', async ({ page }) => {
  await page.goto('/?mock=fail-feed');
  const alert = panel(page).getByRole('alert');
  await expect(alert).toContainText('Live wins did not load');
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(panel(page).getByRole('heading', { name: 'Live wins' })).toBeFocused();
  await expect(panel(page).getByRole('alert')).toBeVisible();
});

test('?mock=empty-feed: empty state with Try again', async ({ page }) => {
  await page.goto('/?mock=empty-feed');
  await expect(panel(page).getByRole('heading', { name: 'No wins yet' })).toBeVisible();
  await panel(page).getByRole('button', { name: 'Try again' }).click();
  await expect(panel(page).getByRole('heading', { name: 'Live wins' })).toBeFocused();
  await expect(panel(page).getByRole('heading', { name: 'No wins yet' })).toBeVisible();
});

test('mobile: collapsed bar expands with aria-expanded and shows the wins', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  const toggle = panel(page).getByRole('button', { name: 'Show live wins' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(list(page)).toBeHidden();
  await toggle.click();
  await expect(panel(page).getByRole('button', { name: 'Hide live wins' })).toHaveAttribute('aria-expanded', 'true');
  await expect(rows(page).first()).toBeVisible();
});
