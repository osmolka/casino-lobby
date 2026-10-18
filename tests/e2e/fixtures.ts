import { test as base, expect, type Page } from '@playwright/test';

/**
 * Chrome reports some warnings (e.g. unused preloads) only seconds after load. Only the console-cleanliness
 * tests wait that long (`lobby.dwell()`); every other test still fails on any problem seen while it ran.
 */
export const MIN_DWELL_MS = 5000;

export interface Lobby {
  goto: (path: string) => Promise<void>;
  reload: () => Promise<void>;
  /** Waits until the current page has been open for MIN_DWELL_MS. */
  dwell: () => Promise<void>;
  /** Console errors/warnings, page errors, HTTP >= 400 and failed requests seen so far. */
  problems: string[];
}

/** Logged by Playwright itself (not the app) when `serviceWorkers: 'block'` stops the production registration. */
const SW_BLOCKED = 'Service Worker registration blocked by Playwright';

function collect(page: Page, problems: string[], allowed: readonly string[], swBlocked: boolean) {
  // Only the failure itself is allowed: the failed request and Chrome's matching "Failed to load resource" line.
  const isAllowed = (url: string) => url !== '' && allowed.includes(new URL(url).pathname);
  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return;
    if (swBlocked && msg.type() === 'warning' && msg.text() === SW_BLOCKED) return;
    if (msg.text().startsWith('Failed to load resource:') && isAllowed(msg.location().url)) return;
    problems.push(`console.${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    const error = request.failure()?.errorText ?? '';
    if (error !== 'net::ERR_ABORTED' && !isAllowed(request.url())) problems.push(`request failed: ${error} ${request.url()}`);
  });
}

// `auto`: every test gets the console/network check, including tests that never touch `lobby`.
export const test = base.extend<{ lobby: Lobby; allowedFailures: string[] }>({
  /**
   * URL pathnames whose failed requests are expected (offline / blocked-request tests, pwa.spec.ts only).
   * Everything else, including other URLs failing, still fails the test.
   */
  allowedFailures: [[], { option: true }],
  lobby: [
    async ({ page, allowedFailures, serviceWorkers }, provide) => {
    const problems: string[] = [];
    collect(page, problems, allowedFailures, serviceWorkers === 'block');
    let loadedAt = 0;
    page.on('load', () => {
      loadedAt = Date.now();
    });
    const dwell = async () => {
      const left = loadedAt + MIN_DWELL_MS - Date.now();
      if (left > 0) await page.waitForTimeout(left);
    };
    await provide({
      problems,
      dwell,
      goto: async (path) => {
        await page.goto(path);
      },
      reload: async () => {
        await page.reload();
      },
    });
    expect(problems, 'console/network problems').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
