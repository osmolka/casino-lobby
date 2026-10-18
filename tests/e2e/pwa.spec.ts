import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// H2 runbook (PLAN §9.2), one test per step, against the production preview. Only this spec lets service
// workers register; each test has its own fresh context, so no SW or storage leaks between tests.
test.use({ serviceWorkers: 'allow', allowedFailures: ['/api/games.json'] });

const GAMES = '**/api/games.json';
const SAVED_AT = Date.parse('2026-10-01T09:05:00Z');
const SAVED_TITLE = 'Saved Copy Only';

const heading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Games' });
const cards = (page: Page) => page.locator('main a[id^="game-"]');
const errorState = (page: Page) => page.getByRole('alert').filter({ hasText: 'Games did not load' });
const bannerText = (page: Page) => page.locator('main p[role="status"]').first();
const bannerRetry = (page: Page) => bannerText(page).locator('xpath=..').getByRole('button', { name: 'Try again' });
const feedList = (page: Page) => page.getByRole('complementary', { name: 'Live wins' }).getByRole('list', { name: 'Recent wins' });

/** Waits until the service worker is active and controls this page (clientsClaim). */
async function controlled(page: Page) {
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready;
    return navigator.serviceWorker.controller !== null;
  });
}

/** First visit: the catalog loads (catalog:v1 written) and the SW takes control. */
async function firstVisit(page: Page) {
  await page.goto('/');
  await expect(cards(page)).not.toHaveCount(0);
  await controlled(page);
}

/**
 * Replaces catalog:v1 with one distinct game, saved at SAVED_AT. Seeing it after a reload proves the data
 * came from catalog:v1 and not from the network or the HTTP cache (which would hold the real list).
 */
async function seedSavedCatalog(page: Page) {
  await page.evaluate(
    ({ savedAt, title }) => {
      const { games } = JSON.parse(localStorage.getItem('catalog:v1') ?? 'null') as { games: { id: string; title: string }[] };
      const game = { ...games[0], id: 'saved-copy', title };
      localStorage.setItem('catalog:v1', JSON.stringify({ fetchedAt: savedAt, games: [game] }));
    },
    { savedAt: SAVED_AT, title: SAVED_TITLE },
  );
}

/** The saved time as the banner formats it (en, the browser's time zone, not today). */
const savedTime = (page: Page) =>
  page.evaluate(
    (at) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(at),
    SAVED_AT,
  );

/**
 * DevTools "Clear site data" with only local storage checked: the SW and its precache stay (clearing those
 * too leaves no shell offline). The CDP session is detached at once: while one is attached, a reloaded page
 * reports navigator.onLine true under Playwright's offline emulation (seen with Playwright 1.63).
 */
async function clearLocalStorage(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Storage.clearDataForOrigin', { origin: new URL(page.url()).origin, storageTypes: 'local_storage' });
  await cdp.detach();
}

/** PNG width and height from the IHDR chunk. */
function pngSize(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

test('H2 step 1: manifest and icons resolve; Chromium reports no installability or manifest errors', async ({ page }) => {
  await firstVisit(page);

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');
  const manifest = (await (await page.request.get(href ?? '')).json()) as {
    display: string;
    start_url: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/' });
  for (const icon of manifest.icons) {
    const response = await page.request.get(`/${icon.src}`);
    expect(response.ok(), icon.src).toBe(true);
    expect(response.headers()['content-type']).toBe('image/png');
    expect(pngSize(await response.body()), icon.src).toBe(icon.sizes);
  }
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);

  // Chrome DevTools Protocol: what the Application → Manifest panel reports.
  const cdp = await page.context().newCDPSession(page);
  const { errors, url } = await cdp.send('Page.getAppManifest', {});
  expect(url).toMatch(/\/manifest\.webmanifest$/);
  expect(errors).toEqual([]);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);

  // The data the app owns is never in the SW caches (neither precache nor runtime); promos are precached.
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(new URL(request.url).pathname);
    }
    return urls;
  });
  expect(cached).toContain('/api/promos.json');
  expect(cached.some((path) => path.includes('games.json'))).toBe(false);
});

test('H2 step 2: offline reload shows the shell, the catalog from catalog:v1 and the offline banner', async ({ page, context }) => {
  await firstVisit(page);
  await seedSavedCatalog(page);
  await context.setOffline(true);
  await page.reload();

  await expect(heading(page)).toBeVisible();
  await expect(bannerText(page)).toHaveText(`You are offline. Showing games saved at ${await savedTime(page)}.`);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText(SAVED_TITLE);
  // Catalog and feed agree: the feed's game titles also come from catalog:v1.
  await expect(feedList(page).getByRole('listitem').first()).toContainText(SAVED_TITLE);
  // Promos come from the precache, so the page is complete offline.
  await expect(page.getByRole('list', { name: 'Current promotions' }).getByRole('link')).not.toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Promotions did not load' })).toHaveCount(0);
  // Deposits are blocked while offline (phase 3).
  await page.getByRole('banner').getByRole('button', { name: 'Deposit' }).click();
  await expect(page.getByRole('dialog', { name: 'Deposit' }).getByRole('button', { name: 'Confirm deposit' })).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');

  // Back online with focus on the banner's Retry: the automatic reload removes it, focus goes to the h1.
  await bannerRetry(page).focus();
  await context.setOffline(false);
  await expect(cards(page)).not.toHaveCount(1);
  await expect(page.locator('main').getByText(SAVED_TITLE)).toHaveCount(0); // wins already in the feed keep their titles
  await expect(bannerText(page)).toHaveText('Catalog loaded');
  await expect(heading(page)).toBeFocused();
});

test('H2 step 3: no saved catalog + offline → error with Retry; online loads it without a click; Retry for a failing server', async ({ page, context }) => {
  await firstVisit(page);
  await clearLocalStorage(page);
  await context.setOffline(true);
  await page.reload();

  await expect(errorState(page)).toBeVisible();
  await expect(bannerText(page)).toHaveText('You are offline. Live wins and deposits are paused until the connection is back.');
  // Retry while offline: the error stays, focus on the h1 (never body).
  await errorState(page).getByRole('button', { name: 'Try again' }).click();
  await expect(heading(page)).toBeFocused();
  await expect(errorState(page)).toBeVisible();
  await expect(heading(page)).toBeFocused();

  // Online: the catalog loads by itself.
  await context.setOffline(false);
  await expect(cards(page)).not.toHaveCount(0);
  await expect(errorState(page)).toHaveCount(0);
  await expect(bannerText(page)).toHaveText('Catalog loaded');

  // Network up, server failing (request aborted), nothing saved: error; Retry after unblocking loads it.
  await clearLocalStorage(page);
  await page.route(GAMES, (route) => route.abort());
  await page.reload();
  await expect(errorState(page)).toBeVisible();
  await expect(bannerText(page)).toHaveText('');
  await page.unroute(GAMES);
  await errorState(page).getByRole('button', { name: 'Try again' }).click();
  await expect(cards(page)).not.toHaveCount(0);
  await expect(heading(page)).toBeFocused();
});

test('H2 step 4: online but games.json blocked → saved catalog + "could not refresh" banner; Retry recovers', async ({ page }) => {
  await firstVisit(page);
  await seedSavedCatalog(page);
  await page.route(GAMES, (route) => route.abort());
  await page.reload();

  await expect(bannerText(page)).toHaveText(`Could not refresh the games. Showing games saved at ${await savedTime(page)}.`);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText(SAVED_TITLE);
  await expect(page.getByText(/Showing games saved at/)).toHaveCount(1); // one visible source

  await page.unroute(GAMES);
  await bannerRetry(page).click();
  await expect(page.locator('main').getByText(SAVED_TITLE)).toHaveCount(0);
  await expect(cards(page)).not.toHaveCount(1);
  await expect(bannerText(page)).toHaveText('Catalog loaded');
  await expect(heading(page)).toBeFocused(); // the clicked Retry disappeared
});

test('mock flags still work with the SW in control: ?mock=fail-promos and ?mock=empty-promos', async ({ page }) => {
  await firstVisit(page);
  await page.goto('/?mock=fail-promos');
  await expect(page.getByRole('heading', { name: 'Promotions did not load' })).toBeVisible();
  await page.goto('/?mock=empty-promos');
  await expect(page.getByRole('heading', { name: 'No promotions right now' })).toBeVisible();
});

test('banner at 360px: no horizontal scroll, header stays sticky, card scroll-margin clears the header', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await firstVisit(page);
  await page.route(GAMES, (route) => route.abort());
  await page.reload(); // real catalog:v1 from the first visit: many cards, so the page scrolls
  await expect(bannerText(page)).toContainText('Could not refresh the games.');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0); // negative: the reserved scrollbar gutter
  const banner = await bannerText(page).locator('xpath=..').boundingBox();
  expect(banner && banner.x >= 0 && banner.x + banner.width <= 360).toBe(true);
  // The banner wraps its text and keeps Retry a full-size target.
  const retry = await bannerRetry(page).boundingBox();
  expect(retry && retry.height >= 24 && retry.width >= 24).toBe(true);

  // A card further down: following its #game-<id> link scrolls it below the sticky header, not under it.
  const card = cards(page).nth(8);
  const id = await card.getAttribute('id');
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, `#${id ?? ''}`);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const header = await page.getByRole('banner').boundingBox();
  const target = await card.boundingBox();
  expect(header?.y).toBe(0);
  expect(target && header && target.y >= header.y + header.height).toBe(true);
});
