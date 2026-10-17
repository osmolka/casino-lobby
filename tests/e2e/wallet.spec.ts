import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const header = (page: Page) => page.getByRole('banner');
const balance = (page: Page) => header(page).getByRole('button', { name: /^Balance:/ });
const depositButton = (page: Page) => header(page).getByRole('button', { name: 'Deposit', exact: true }).first();
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Deposit' });
const confirm = (page: Page) => dialog(page).getByRole('button', { name: /Confirm deposit|Processing/ });
const panel = (page: Page) => page.getByRole('region', { name: 'Wallet' });
const rows = (page: Page) => panel(page).getByRole('listitem');

async function open(page: Page, path = '/') {
  await page.goto(path);
  await expect(balance(page)).toBeVisible();
}

async function openDeposit(page: Page, amount: string, currency?: string) {
  await depositButton(page).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByLabel('Amount').fill(amount);
  if (currency) await dialog(page).getByLabel('Currency').selectOption(currency);
}

async function expandPanel(page: Page) {
  if ((await balance(page).getAttribute('aria-expanded')) !== 'true') await balance(page).click();
  await expect(panel(page)).toBeVisible();
}

/** Samples the visible (animated) balance on every frame for `ms`, starting now. */
function sampleBalance(page: Page, ms: number): Promise<string[]> {
  return page.evaluate(
    (duration) =>
      new Promise<string[]>((resolve) => {
        const el = document.querySelector('header bdi[aria-hidden="true"]');
        const seen: string[] = [];
        const start = performance.now();
        const tick = () => {
          seen.push(el?.textContent ?? '');
          if (performance.now() - start < duration) requestAnimationFrame(tick);
          else resolve(seen);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

const distinct = (values: string[]) => [...new Set(values)];

test('deposit 100: optimistic pending, balance animates up, confirmed, focus back on Deposit', async ({ page }) => {
  await open(page);
  await expect(balance(page)).toHaveAccessibleName('Balance: €695.25');
  await expandPanel(page); // before the dialog: a modal dialog makes the page inert
  await openDeposit(page, '100');
  await expect(dialog(page).locator('dl')).toHaveText('You deposit€100You receive€100.00');

  const sampling = sampleBalance(page, 1000);
  await confirm(page).click();
  await expect(confirm(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(rows(page).first()).toContainText('Pending');
  const samples = distinct(await sampling);
  expect(samples.at(0)).toBe('€695.25');
  expect(samples.at(-1)).toBe('€795.25');
  expect(samples.length, `intermediate frames: ${samples.join(' ')}`).toBeGreaterThan(3);

  await expect(dialog(page)).toBeHidden();
  await expect(rows(page).first()).toContainText('Confirmed');
  await expect(balance(page)).toHaveAccessibleName('Balance: €795.25');
  await expect(depositButton(page)).toBeFocused();
});

test('reduced motion: the balance jumps to the new value', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await openDeposit(page, '100');
  const sampling = sampleBalance(page, 300);
  await confirm(page).click();
  expect(distinct(await sampling)).toEqual(['€695.25', '€795.25']);
});

test('deposit 109: alert in the dialog, Failed in the list, balance rolled back', async ({ page }) => {
  await open(page);
  await expandPanel(page);
  await openDeposit(page, '109');
  await confirm(page).click();
  await expect(rows(page).first()).toContainText('Pending');
  await expect(dialog(page).getByRole('alert')).toHaveText('The deposit of €109 failed. Your balance was not changed.');
  await expect(rows(page).first()).toContainText('€109.00');
  await expect(rows(page).first()).toContainText('Failed');
  await expect(rows(page)).toHaveCount(6);
  await expect(balance(page)).toHaveAccessibleName('Balance: €695.25');
  await expect(header(page).locator('bdi[aria-hidden="true"]')).toHaveText('€695.25');
});

test('double click, and Enter + click, each create one transaction', async ({ page }) => {
  await open(page);
  await expandPanel(page);

  await openDeposit(page, '100');
  await confirm(page).dblclick();
  await expect(dialog(page)).toBeHidden();
  await expect(rows(page)).toHaveCount(6);

  await openDeposit(page, '50');
  await dialog(page).getByLabel('Amount').press('Enter');
  // force: Confirm is aria-disabled now (Playwright would wait); a user can still click it.
  await confirm(page).click({ force: true });
  await expect(dialog(page)).toBeHidden();
  await expect(rows(page)).toHaveCount(6); // list shows the 6 most recent
  await expect(rows(page).nth(0)).toContainText('€50.00');
  await expect(rows(page).nth(1)).toContainText('€100.00');
  await expect(rows(page).nth(2)).toContainText('€20.00'); // newest fixture entry: no duplicates above it
  await expect(balance(page)).toHaveAccessibleName('Balance: €845.25');
});

test('Esc while a failing deposit is in flight: dialog closes, failure is announced in the widget', async ({ page }) => {
  await open(page);
  await openDeposit(page, '19');
  await confirm(page).click();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(depositButton(page)).toBeFocused();
  const alert = header(page).getByRole('alert');
  await expect(alert).toContainText('Deposit of €19 failed. Your balance was not changed.');
  await expect(balance(page)).toHaveAccessibleName('Balance: €695.25');
  await expandPanel(page);
  await expect(rows(page).first()).toContainText('Failed');
});

test('offline: deposit blocked with a message', async ({ page, context }) => {
  await open(page);
  // Every region has loaded: a request still in flight (e.g. promos) would fail once offline.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await openDeposit(page, '100');
  await context.setOffline(true);
  await expect(dialog(page).getByRole('status')).toHaveText('You are offline. Deposits are paused until the connection is back.');
  await expect(confirm(page)).toHaveAttribute('aria-disabled', 'true');
  await confirm(page).click({ force: true });
  await expect(confirm(page)).toHaveText('Confirm deposit');
  await context.setOffline(false);
  await expect(dialog(page).getByRole('status')).toHaveText('');
  await page.keyboard.press('Escape');
  await expandPanel(page);
  await expect(rows(page)).toHaveCount(5);
});

test('confirmed deposits survive a reload; corrupt wallet:v1 falls back to the fixture', async ({ page, lobby }) => {
  await open(page);
  await openDeposit(page, '100');
  await confirm(page).click();
  await expect(dialog(page)).toBeHidden();
  await lobby.reload();
  await expect(balance(page)).toHaveAccessibleName('Balance: €795.25');

  await page.evaluate(() => {
    localStorage.setItem('wallet:v1', '{oops');
  });
  await lobby.reload();
  await expect(balance(page)).toHaveAccessibleName('Balance: €695.25');
});

test('wallet mocks: fail-wallet shows Retry, empty-wallet shows the empty state', async ({ page }) => {
  await page.goto('/?mock=fail-wallet');
  await expect(header(page).getByRole('alert')).toContainText('Wallet unavailable');
  await expect(header(page).getByRole('button', { name: 'Try again' })).toBeVisible();

  await open(page, '/?mock=empty-wallet');
  await expect(balance(page)).toHaveAccessibleName('Balance: €0.00');
  await expandPanel(page);
  await expect(panel(page).getByRole('heading', { name: 'No transactions yet' })).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme} 360px: dialog fits, uses theme tokens, page scroll is locked`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page);
    await openDeposit(page, '10.90', 'USD');

    const m = await page.evaluate(() => {
      const dlg = document.querySelector('dialog');
      const rect = dlg?.getBoundingClientRect();
      const root = getComputedStyle(document.documentElement);
      return {
        start: rect?.left ?? -1,
        end: rect?.right ?? Infinity,
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        overflow: root.overflow,
        surface: dlg ? getComputedStyle(dlg).backgroundColor : '',
        backdrop: dlg ? getComputedStyle(dlg, '::backdrop').backgroundColor : '',
      };
    });
    expect(m.start).toBeGreaterThanOrEqual(0);
    expect(m.end).toBeLessThanOrEqual(360);
    expect(m.sw).toBeLessThanOrEqual(m.cw);
    expect(m.overflow).toBe('hidden');
    expect(m.surface).toBe(scheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(26, 29, 39)');
    expect(m.backdrop).toBe(scheme === 'light' ? 'rgba(21, 24, 35, 0.55)' : 'rgba(0, 0, 0, 0.7)');

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');

    await expandPanel(page);
    const p = await panel(page).boundingBox();
    expect(p?.x).toBeGreaterThanOrEqual(0);
    expect((p?.x ?? 0) + (p?.width ?? Infinity)).toBeLessThanOrEqual(360);
  });
}
