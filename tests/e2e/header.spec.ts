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

const BALANCES = [
  { name: 'fixture balance €695.25', text: '€695.25', stored: null },
  { name: 'wide balance €10,695.25', text: '€10,695.25', stored: WIDE_WALLET },
] as const;

async function open(page: Page, stored: string | null, text: string) {
  if (stored) {
    await page.addInitScript((value) => {
      localStorage.setItem('wallet:v1', value);
    }, stored);
  }
  await page.goto('/');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('banner').locator('bdi[aria-hidden="true"]')).toHaveText(text);
}

/** Logo and every visible header control: rects, rows, overflow. */
function measure(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('header');
    if (!header) throw new Error('no header');
    const els = [header.querySelector('a'), ...header.querySelectorAll('[role="group"] button')].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.offsetParent !== null && !el.closest('[hidden], dialog'),
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
    return { viewport, scrollWidth: document.documentElement.scrollWidth, headerHeight: header.getBoundingClientRect().height, items };
  });
}

type Measured = Awaited<ReturnType<typeof measure>>;

/** Distinct rows of header controls (logo excluded: it is centered against all rows). */
const rows = (m: Measured) => [...new Set(m.items.slice(1).map((i) => Math.round(i.y)))].sort((a, b) => a - b);

function expectSound(m: Measured) {
  expect(m.scrollWidth, 'no horizontal scroll').toBeLessThanOrEqual(m.viewport);
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

async function expectThemeOneClick(page: Page) {
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByRole('banner').getByRole('button', { name: 'Dark theme' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before ?? '');
}

// Phones: overlay scrollbars, the full 360px for content.
test.describe('360px phone (overlay scrollbars)', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  for (const balance of BALANCES) {
    test(`${balance.name}: header on one row, nothing clipped, no horizontal scroll, theme in one tap`, async ({ page }) => {
      await open(page, balance.stored, balance.text);
      const m = await measure(page);
      expect(m.viewport).toBe(360);
      expectSound(m);
      expect(rows(m), 'one row').toHaveLength(1);
      await expectThemeOneClick(page);
    });
  }
});

// A desktop window 360px wide: a classic 15px scrollbar leaves 345px. The wide balance may wrap the settings
// button to a second row; the wrap must stay tidy (rows end-aligned, nothing overlapping or clipped).
test.describe('360px window (classic scrollbar)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test(`${BALANCES[0].name}: header on one row`, async ({ page }) => {
    await open(page, BALANCES[0].stored, BALANCES[0].text);
    const m = await measure(page);
    expectSound(m);
    expect(rows(m), 'one row').toHaveLength(1);
    await expectThemeOneClick(page);
  });

  test(`${BALANCES[1].name}: at most two rows, end-aligned; theme toggle stays on the first row`, async ({ page }) => {
    await open(page, BALANCES[1].stored, BALANCES[1].text);
    const m = await measure(page);
    expectSound(m);
    const lines = rows(m);
    expect(lines.length).toBeLessThanOrEqual(2);
    const ends = lines.map((y) => Math.max(...m.items.slice(1).filter((i) => Math.round(i.y) === y).map((i) => i.right)));
    for (const end of ends) expect(Math.abs(end - (ends[0] ?? 0)), 'rows end-aligned').toBeLessThanOrEqual(1);
    const theme = m.items.find((i) => i.name === 'Dark theme');
    expect(Math.round(theme?.y ?? -1), 'theme toggle on the first row').toBe(lines[0]);
    await expectThemeOneClick(page);
  });
});
