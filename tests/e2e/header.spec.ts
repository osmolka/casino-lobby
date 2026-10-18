import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/** €10,695.25: one stored opening deposit (wallet:v1 is validated on read, so it must be a real confirmed entry). */
const WIDE_WALLET = JSON.stringify([
  {
    id: 'wide',
    kind: 'opening',
    amount: 1_069_525,
    source: { amount: 1_069_525, currency: 'EUR' },
    status: 'confirmed',
    createdAt: '2026-09-01T09:00:00.000Z',
  },
]);

/**
 * Spare width on a 360px phone between the logo and the controls (bundled Chromium + bundled Inter, so it is
 * deterministic; ±1px). Measured in phase 6a, recorded in PROGRESS.md.
 */
const LOCALES = [
  {
    code: 'en',
    theme: 'Dark theme',
    balances: [
      { name: 'fixture', text: '€695.25', stored: null, phoneSpare: 31 },
      { name: 'wide', text: '€10,695.25', stored: WIDE_WALLET, phoneSpare: 7 },
    ],
  },
  {
    code: 'ru',
    theme: 'Тёмная тема',
    balances: [
      { name: 'fixture', text: '695,25 €', stored: null, phoneSpare: 27 },
      { name: 'wide', text: '10 695,25 €', stored: WIDE_WALLET, phoneSpare: 3 },
    ],
  },
] as const;

type Balance = (typeof LOCALES)[number]['balances'][number];

async function open(page: Page, locale: string, balance: Balance) {
  await page.addInitScript(
    ([code, stored]) => {
      localStorage.setItem('lobby.locale', code);
      if (stored) localStorage.setItem('wallet:v1', stored);
    },
    [locale, balance.stored] as const,
  );
  await page.goto('/');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('banner').locator('bdi[aria-hidden="true"]')).toHaveText(balance.text);
}

/** Logo and every visible header control: rects, rows, overflow, and the spare width before the controls. */
function measure(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('header');
    const group = header?.querySelector('[role="group"]');
    const logo = header?.querySelector('a');
    if (!header || !group || !logo) throw new Error('no header');
    const els: HTMLElement[] = [logo, ...group.querySelectorAll('button')].filter(
      (el) => el.offsetParent !== null && !el.closest('[hidden], dialog'),
    );
    const viewport = document.documentElement.clientWidth;
    const items = els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        name: (el.getAttribute('aria-label') ?? el.textContent).trim().slice(0, 24),
        x: r.left,
        y: r.top,
        right: r.right,
        bottom: r.bottom,
        w: r.width,
        h: r.height,
        clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
      };
    });
    const balance = group.querySelector('button[aria-expanded]');
    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      spare: group.getBoundingClientRect().left - logo.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(header).columnGap),
      balanceWhiteSpace: balance ? getComputedStyle(balance).whiteSpace : '',
      items,
    };
  });
}

type Measured = Awaited<ReturnType<typeof measure>>;

/** Distinct rows of header controls (logo excluded: it is centered against all rows). */
const rows = (m: Measured) => [...new Set(m.items.slice(1).map((i) => Math.round(i.y)))].sort((a, b) => a - b);

function expectSound(m: Measured) {
  expect(m.scrollWidth, 'no horizontal scroll').toBeLessThanOrEqual(m.viewport);
  expect(m.balanceWhiteSpace, 'the balance never breaks (ru: no-break space before €)').toBe('nowrap');
  for (const item of m.items) {
    expect(item.x, `${item.name} inside the viewport`).toBeGreaterThanOrEqual(0);
    expect(item.right, `${item.name} inside the viewport`).toBeLessThanOrEqual(m.viewport);
    expect(item.clipped, `${item.name} not clipped`).toBe(false);
    expect(Math.min(item.w, item.h), `${item.name} ≥ 24×24`).toBeGreaterThanOrEqual(24);
  }
  // No two controls overlap.
  for (const [i, a] of m.items.entries()) {
    for (const b of m.items.slice(i + 1)) {
      const overlap = a.x < b.right - 0.5 && b.x < a.right - 0.5 && a.y < b.bottom - 0.5 && b.y < a.bottom - 0.5;
      expect(overlap, `${a.name} / ${b.name} overlap`).toBe(false);
    }
  }
}

async function expectThemeOneClick(page: Page, label: string) {
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByRole('banner').getByRole('button', { name: label }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? '');
}

for (const locale of LOCALES) {
  // Phones: overlay scrollbars, the full 360px for content.
  test.describe(`${locale.code}, 360px phone (overlay scrollbars)`, () => {
    test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

    for (const balance of locale.balances) {
      test(`${balance.name} balance ${balance.text}: one row, ${balance.phoneSpare}px spare, nothing clipped, theme in one tap`, async ({
        page,
      }) => {
        await open(page, locale.code, balance);
        const m = await measure(page);
        expect(m.viewport).toBe(360);
        expectSound(m);
        expect(rows(m), 'one row').toHaveLength(1);
        expect(Math.abs(m.spare - balance.phoneSpare), `spare ${m.spare}px`).toBeLessThanOrEqual(1);
        await expectThemeOneClick(page, locale.theme);
      });
    }
  });

  // A desktop window 360px wide: a classic 15px scrollbar leaves 345px. The wide balance may wrap the settings
  // button to a second row; the wrap must stay tidy (rows end-aligned, nothing overlapping or clipped).
  test.describe(`${locale.code}, 360px window (classic scrollbar)`, () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test(`fixture balance ${locale.balances[0].text}: header on one row`, async ({ page }) => {
      await open(page, locale.code, locale.balances[0]);
      const m = await measure(page);
      expectSound(m);
      expect(rows(m), 'one row').toHaveLength(1);
      await expectThemeOneClick(page, locale.theme);
    });

    test(`wide balance ${locale.balances[1].text}: at most two rows, end-aligned; theme toggle on the first row`, async ({ page }) => {
      await open(page, locale.code, locale.balances[1]);
      const m = await measure(page);
      expectSound(m);
      const lines = rows(m);
      expect(lines.length).toBeLessThanOrEqual(2);
      const ends = lines.map((y) => Math.max(...m.items.slice(1).filter((i) => Math.round(i.y) === y).map((i) => i.right)));
      for (const end of ends) expect(Math.abs(end - (ends[0] ?? 0)), 'rows end-aligned').toBeLessThanOrEqual(1);
      const theme = m.items.find((i) => i.name === locale.theme);
      expect(Math.round(theme?.y ?? -1), 'theme toggle on the first row').toBe(lines[0]);
      await expectThemeOneClick(page, locale.theme);
    });
  });
}
