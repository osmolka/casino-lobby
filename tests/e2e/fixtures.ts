import { test as base, expect, type Page } from '@playwright/test';

/** Chrome reports some warnings (e.g. unused preloads) only seconds after load: every page stays open >= 5 s. */
export const MIN_DWELL_MS = 5000;

export interface Lobby {
  goto: (path: string) => Promise<void>;
  reload: () => Promise<void>;
  /** Waits until the current page has been open for MIN_DWELL_MS. */
  dwell: () => Promise<void>;
  /** Console errors/warnings, page errors, HTTP >= 400 and failed requests seen so far. */
  problems: string[];
}

function collect(page: Page, problems: string[]) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`console.${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    const error = request.failure()?.errorText ?? '';
    if (error !== 'net::ERR_ABORTED') problems.push(`request failed: ${error} ${request.url()}`);
  });
}

export const test = base.extend<{ lobby: Lobby }>({
  lobby: async ({ page }, provide) => {
    const problems: string[] = [];
    collect(page, problems);
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
        await dwell();
        await page.goto(path);
      },
      reload: async () => {
        await dwell();
        await page.reload();
      },
    });
    await dwell();
    expect(problems, 'console/network problems').toEqual([]);
  },
});

export { expect };
