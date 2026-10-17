import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

interface ViewState {
  url: string;
  names: string[];
  count: string;
  pressed: string[];
  checked: string[];
  sort: string;
  q: string;
}

/** Everything a user sees of the filter state, plus the card list in order. */
function viewState(page: Page): Promise<ViewState> {
  return page.evaluate(() => {
    // A card's accessible name comes from its content (see 'cards are named by their visible content').
    const name = (a: Element) => a.textContent;
    return {
      url: location.search + location.hash,
      names: [...document.querySelectorAll('main a[href^="#game-"]')].map(name),
      count: document.querySelector('main [role=status]')?.textContent ?? '',
      pressed: [...document.querySelectorAll('main [aria-pressed=true]')].map((b) => b.textContent),
      checked: [...document.querySelectorAll<HTMLInputElement>('main input[type=checkbox]:checked')].map(
        (i) => i.parentElement?.textContent ?? '',
      ),
      sort: document.querySelector('select')?.value ?? '',
      q: document.querySelector<HTMLInputElement>('input[type=search]')?.value ?? '',
    };
  });
}

/** The view without the URL (Forward may restore it via a different but equivalent history entry). */
const view = (s: ViewState): Omit<ViewState, 'url'> => ({ names: s.names, count: s.count, pressed: s.pressed, checked: s.checked, sort: s.sort, q: s.q });

async function ready(page: Page) {
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  await expect(page.locator('main [role=status]')).not.toHaveText('');
}

const group = (page: Page, name: string) => page.getByRole('group', { name });
const COMBINED = /^\?cat=slots&prov=[a-z-]+,[a-z-]+&tag=megaways&q=a&sort=rtp$/;

/** Builds slots + 2 providers + megaways + sort=rtp + q=a by clicking; returns the state after each history entry. */
async function buildCombinedView(page: Page) {
  await ready(page);
  await group(page, 'Category').getByRole('button', { name: 'Slots' }).click();
  const providers = group(page, 'Provider').getByRole('checkbox');
  await providers.nth(0).check();
  await providers.nth(2).check();
  const s2 = await viewState(page);
  await group(page, 'Tag').getByRole('button', { name: 'Megaways' }).click();
  const s3 = await viewState(page);
  await page.getByRole('combobox', { name: 'Sort by' }).selectOption('rtp');
  await page.getByRole('searchbox', { name: 'Search games' }).fill('a');
  await expect(page).toHaveURL(/q=a/);
  return { s2, s3, s5: await viewState(page) };
}

test('combined view: history, Back/Forward, card link and deep links reproduce it', async ({ page, lobby }) => {
  await lobby.goto('/');
  await ready(page);
  expect((await viewState(page)).names).toHaveLength(100);

  const { s2, s3, s5 } = await buildCombinedView(page);
  expect(s5.url).toMatch(COMBINED);
  expect(s5.names.length).toBeGreaterThan(0);
  // about:blank + / + cat + prov + prov + tag + sort (search replaced the sort entry).
  expect(await page.evaluate(() => history.length)).toBe(7);

  await page.goBack();
  expect(await viewState(page)).toEqual(s3);
  await page.goBack();
  expect(await viewState(page)).toEqual(s2);
  await page.goForward();
  expect(view(await viewState(page))).toEqual(view(s3));
  await page.goForward();
  expect(view(await viewState(page))).toEqual(view(s5));

  // Card link: #game-<id>, the card is its own :target, filters untouched.
  const card = page.locator('main a[href^="#game-"]').first();
  const id = await card.getAttribute('id');
  await card.click();
  const afterClick = await viewState(page);
  expect(afterClick.url).toBe(`${s5.url}#${id ?? ''}`);
  expect(view(afterClick)).toEqual(view(s5));
  const target = await page.evaluate(() => {
    const t = document.querySelector(':target');
    return t && { id: t.id, outline: getComputedStyle(t).outlineStyle, margin: getComputedStyle(t).scrollMarginBlockStart };
  });
  expect(target?.id).toBe(id);
  expect(target?.outline).toBe('dashed');
  expect(target?.margin).not.toBe('0px');
  await page.goBack();
  expect(await viewState(page)).toEqual(s5);

  // A fresh load of the URL gives the identical view.
  await lobby.goto(`/${s5.url}`);
  await ready(page);
  expect(await viewState(page)).toEqual(s5);

  // Non-canonical order of the same filters → same view, URL canonicalized.
  const prov = /prov=([^&]+)/.exec(s5.url)?.[1]?.split(',').reverse().join(',') ?? '';
  await lobby.goto(`/?q=a&sort=rtp&tag=megaways&prov=${prov}&cat=slots`);
  await ready(page);
  expect(await viewState(page)).toEqual(s5);
});

test('cards are named by their visible content (Label in Name)', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const card = page.locator('main a[href^="#game-"]').first();
  await expect(card).not.toHaveAttribute('aria-labelledby');
  await expect(card).not.toHaveAttribute('aria-describedby');
  await expect(card).toHaveAccessibleName('Neon Treasure Ember Games Bonus buy New RTP 97.72% Bet €0.20 – €500.00');
  await expect(card).toHaveAccessibleDescription('');
});

test('garbage URL renders the full catalog', async ({ page, lobby }) => {
  await lobby.goto('/?cat=casino&prov=%%%,UPPER,<b>&tag=../x&sort=random&foo=bar&%E0%A4%A=1');
  await ready(page);
  expect((await viewState(page)).names).toHaveLength(100);
});

test('malformed q and a huge provider list show the empty state without crashing', async ({ page, lobby }) => {
  await lobby.goto(`/?q=%E0%A4%A&prov=${'x,'.repeat(500)}`);
  await expect(page.getByRole('heading', { level: 2, name: 'No games match these filters' })).toBeVisible();
});

test('empty state: Clear filters restores defaults incl. sort, keeps mock, focuses the heading', async ({ page, lobby }) => {
  await lobby.goto('/?cat=table&q=zzzz&sort=rtp&mock=slow');
  const empty = page.locator('main').getByRole('button', { name: 'Clear filters' }).last();
  await expect(page.getByRole('heading', { level: 2, name: 'No games match these filters' })).toBeVisible({ timeout: 8000 });
  await empty.click();
  const state = await viewState(page);
  expect(state.url).toBe('?mock=slow');
  expect(state.names).toHaveLength(100);
  expect(state.sort).toBe('trending');
  expect(state.q).toBe('');
  await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeFocused();
});

test('error state: Retry shows the skeleton and focuses the heading', async ({ page, lobby }) => {
  await lobby.goto('/?mock=fail-catalog');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Could not reach the server');
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeFocused();
  await expect(page.getByRole('alert')).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  for (const width of [360, 768, 1024, 1440]) {
    test(`${scheme} ${width}px: no horizontal scroll (default and combined view)`, async ({ page, lobby }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', '/?cat=slots&prov=aurora-studios,ember-games&tag=megaways&q=a&sort=rtp']) {
        await lobby.goto(path);
        await ready(page);
        const toggle = page.getByRole('button', { name: /^Filters/ });
        if (await toggle.isVisible()) await toggle.click();
        const m = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
          theme: document.documentElement.dataset.theme,
        }));
        expect(m.theme).toBe(scheme);
        expect(m.sw, `${path} scrollWidth`).toBeLessThanOrEqual(m.cw);
      }
    });
  }
}

// Split into parallel tests: each step dwells MIN_DWELL_MS for late warnings, so one long test would dominate the suite.
const CLEAN_RUNS: [name: string, steps: string[]][] = [
  ['home', ['/', '/', 'reload', 'reload']],
  ['filtered', ['/?cat=slots&sort=rtp', '/?cat=slots&sort=rtp', 'reload', '/']],
  ['catalog mocks', ['/?mock=slow', '/?mock=fail-catalog', 'reload']],
  ['wallet mocks', ['/?mock=fail-wallet', '/?mock=empty-wallet', 'reload']],
];

for (const [name, steps] of CLEAN_RUNS) {
  test(`console stays clean over repeated navigations and reloads in one tab (${name})`, async ({ page, lobby }) => {
    for (const step of steps) {
      if (step === 'reload') await lobby.reload();
      else await lobby.goto(step);
      await lobby.dwell();
      expect(lobby.problems, `after ${step}`).toEqual([]);
    }
    await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible();
  });
}
