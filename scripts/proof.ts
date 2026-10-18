// Usage: npm run start:pwa, then in a second terminal: node scripts/proof.ts [baseURL]  (Node >= 22.18)
// Writes proof/palette.png and proof/offline.png (1440×900, dark theme).
import { mkdirSync } from 'node:fs';
import { chromium, type Browser, type BrowserContextOptions } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://localhost:4173';
const outDir = new URL('../proof/', import.meta.url);
const contextOptions: BrowserContextOptions = {
  baseURL,
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
  reducedMotion: 'reduce',
};

async function palette(browser: Browser) {
  const context = await browser.newContext({ ...contextOptions, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('list', { name: 'Current promotions' }).getByRole('link').first().waitFor();
  await page.keyboard.press('Control+KeyK');
  const dialog = page.getByRole('dialog', { name: 'Search and commands' });
  // `live` spans two groups: games ranked prefix > subsequence, then the provider.
  await dialog.getByRole('combobox').fill('live');
  await dialog.getByRole('option', { name: /Silverline Live/ }).waitFor();
  await page.screenshot({ path: new URL('palette.png', outDir).pathname });
  await context.close();
}

async function offline(browser: Browser) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  // First visit online: the SW precaches the shell, the catalog is saved to catalog:v1.
  await page.goto('/');
  await page.waitForFunction('navigator.serviceWorker.controller !== null');
  await page.locator('main a[href^="#game-"]').first().waitFor();
  await context.setOffline(true);
  await page.reload();
  await page.getByText(/^You are offline/).waitFor();
  await page.locator('main a[href^="#game-"]').first().waitFor();
  await page.getByRole('list', { name: 'Current promotions' }).getByRole('link').first().waitFor();
  await page.screenshot({ path: new URL('offline.png', outDir).pathname });
  await context.close();
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  await palette(browser);
  await offline(browser);
} finally {
  await browser.close();
}
console.log(`Wrote palette.png and offline.png to ${outDir.pathname}`);
