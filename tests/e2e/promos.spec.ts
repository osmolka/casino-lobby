import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const region = (page: Page) => page.getByRole('region', { name: 'Promotions' });
const list = (page: Page) => page.getByRole('list', { name: 'Current promotions' });
const gamesHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Games' });
const prevButton = (page: Page) => region(page).getByRole('button', { name: 'Previous promotions' });
const nextButton = (page: Page) => region(page).getByRole('button', { name: 'Next promotions' });

/** Resolves once scrollLeft has not changed for 10 animation frames (momentum and snapping are over). */
function settledScroll(track: Locator) {
  return track.evaluate(
    (el) =>
      new Promise<number>((resolve) => {
        let last = Number.NaN;
        let still = 0;
        const tick = () => {
          if (el.scrollLeft === last) still += 1;
          else [last, still] = [el.scrollLeft, 0];
          if (still >= 10) resolve(last);
          else requestAnimationFrame(tick);
        };
        tick();
      }),
  );
}

/** Track geometry: each card's offset from the snap line (scrollport start + scroll-padding), focus-ring room. */
function geometry(track: Locator) {
  return track.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const snapLine = box.left + el.clientLeft + Number.parseFloat(style.scrollPaddingInlineStart);
    const cards = [...el.querySelectorAll('a')].map((a) => a.getBoundingClientRect());
    const first = cards[0];
    const last = cards.at(-1);
    if (!first || !last) throw new Error('no cards');
    return {
      scrollLeft: el.scrollLeft,
      maxScroll: el.scrollWidth - el.clientWidth,
      snapOffsets: cards.map((c) => Math.abs(c.left - snapLine)),
      // Room around a card for the 3px outline + 2px offset, inside the scrollport.
      ringRoom: {
        start: first.left - box.left,
        top: first.top - box.top,
        bottom: box.top + el.clientHeight - first.bottom,
      },
      lastEndRoom: box.left + el.clientWidth - last.right,
      secondVisible: (cards[1]?.left ?? Infinity) < box.left + el.clientWidth,
      // ≤ 0 means no page horizontal scroll (negative while scrollbar-gutter reserves space).
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function loaded(page: Page) {
  await expect(list(page).getByRole('link')).toHaveCount(5);
}

test.describe('touch, 360px', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test('a swipe scrolls the track natively and it comes to rest snapped to a card', async ({ page }) => {
    await page.goto('/');
    await loaded(page);
    const track = list(page);
    const before = await geometry(track);
    expect(before.scrollLeft).toBe(0);
    await expect(nextButton(page), 'no Prev/Next on a touch pointer').toHaveCount(0);
    await expect(prevButton(page)).toHaveCount(0);
    expect(before.secondVisible, 'the next card peeks').toBe(true);
    expect(before.pageOverflow, 'no page horizontal scroll').toBeLessThanOrEqual(0);

    const box = await track.boundingBox();
    if (!box) throw new Error('track not visible');
    // Real touch input (touchStart → 10 × touchMove → touchEnd): the compositor scrolls the track natively.
    // Input.synthesizeScrollGesture with gestureSourceType 'touch' did not scroll in headless Chromium.
    const cdp = await page.context().newCDPSession(page);
    const y = Math.round(box.y + box.height / 2);
    const startX = Math.round(box.x + box.width * 0.85);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
    for (let step = 1; step <= 10; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX - step * 18, y }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const rest = await settledScroll(track);
    const after = await geometry(track);
    expect(rest).toBeGreaterThan(0);
    const snapped = Math.min(...after.snapOffsets) <= 2 || after.maxScroll - after.scrollLeft <= 2;
    expect(snapped, `snap offsets ${after.snapOffsets.join(', ')}`).toBe(true);
    expect(after.pageOverflow).toBeLessThanOrEqual(0);
  });

  test('edge cards keep room for the focus ring; the last card is fully reachable', async ({ page }) => {
    await page.goto('/');
    await loaded(page);
    const track = list(page);
    const first = await geometry(track);
    for (const [side, room] of Object.entries(first.ringRoom)) expect(room, side).toBeGreaterThanOrEqual(5);

    await track.getByRole('link').last().focus();
    await settledScroll(track);
    const end = await geometry(track);
    expect(end.lastEndRoom).toBeGreaterThanOrEqual(5);
  });
});

test('desktop: next card peeks, no page overflow; a plain click opens the view and Back restores', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?tag=classic&sort=rtp');
  await loaded(page);
  const g = await geometry(list(page));
  expect(g.secondVisible).toBe(true);
  expect(g.maxScroll).toBeGreaterThan(0);
  expect(g.pageOverflow).toBeLessThanOrEqual(0);

  const entries = await page.evaluate(() => history.length);
  await list(page).getByRole('link', { name: /^Live Casino Week/ }).click();
  await expect(page).toHaveURL(/\/\?cat=live&sort=rtp$/);
  await expect(gamesHeading(page)).toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(entries + 1);
  const top = await gamesHeading(page).evaluate((h) => {
    const header = document.querySelector('header');
    return { top: h.getBoundingClientRect().top, headerBottom: header?.getBoundingClientRect().bottom ?? 0 };
  });
  expect(top.top).toBeGreaterThanOrEqual(top.headerBottom);

  await page.goBack();
  await expect(page).toHaveURL(/\/\?tag=classic&sort=rtp$/);
});

for (const width of [360, 1440]) {
  test(`${width}px: the skeleton is as tall as the loaded track (no catalog jump)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?mock=slow');
    const busy = region(page).locator('[aria-busy="true"]');
    await expect(busy).toBeVisible();
    const search = page.getByRole('searchbox');
    const skeleton = { track: (await busy.boundingBox())?.height, search: (await search.boundingBox())?.y };
    await loaded(page);
    const ready = { track: (await list(page).boundingBox())?.height, search: (await search.boundingBox())?.y };
    expect(ready.track).toBeCloseTo(skeleton.track ?? -1, 0);
    expect(ready.search).toBeCloseTo(skeleton.search ?? -1, 0);
  });
}

test('error and empty states are compact and offer Retry', async ({ page }) => {
  await page.goto('/?mock=fail-promos');
  const alert = region(page).getByRole('alert');
  await expect(alert.getByRole('heading', { name: 'Promotions did not load' })).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
  expect((await alert.boundingBox())?.height).toBeLessThan(140);

  await page.goto('/?mock=empty-promos');
  await expect(region(page).getByRole('heading', { name: 'No promotions right now' })).toBeVisible();
  await expect(region(page).getByRole('button', { name: 'Try again' })).toBeVisible();
  expect((await region(page).boundingBox())?.height).toBeLessThan(180);
});

test('360px: every visible button, chip and form control (incl. the settings panel) is at least 24×24 CSS px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await loaded(page);
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: /^Filters/ }).click();
  // Settings panel open too (a click on its toggle is inside it, so the filters stay expanded).
  await page.getByRole('banner').getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('slider', { name: 'Accent hue' })).toBeVisible();
  const { checked, small } = await page.evaluate(() => {
    const targets = [...document.querySelectorAll<HTMLElement>('button, select, input, [role="button"]')].map((el) => {
      // A checkbox's target is its whole label row.
      const target = el instanceof HTMLInputElement && el.type === 'checkbox' ? (el.closest('label') ?? el) : el;
      const r = target.getBoundingClientRect();
      const label = el.getAttribute('aria-label') ?? (el.textContent || el.getAttribute('name') || el.tagName);
      return { label: label.trim().slice(0, 40), w: r.width, h: r.height };
    });
    const visible = targets.filter((t) => t.w > 0 && t.h > 0);
    return {
      checked: visible.length,
      small: visible.filter((t) => t.w < 24 || t.h < 24).map((t) => `${t.label}: ${Math.round(t.w)}×${Math.round(t.h)}`),
    };
  });
  expect(checked).toBeGreaterThan(22); // header, settings (slider, Reset), filters (expanded), sort, chips, checkboxes, feed bar
  expect(small).toEqual([]);
});

for (const width of [1440, 1024]) {
  test(`${width}px: Next scrolls and rests snapped, Prev returns to the start; native scrollbar hidden`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await loaded(page);
    const track = list(page);
    await expect(prevButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(nextButton(page)).not.toHaveAttribute('aria-disabled');
    expect(await track.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe('none');

    await nextButton(page).click();
    expect(await settledScroll(track)).toBeGreaterThan(0);
    const after = await geometry(track);
    const snapped = Math.min(...after.snapOffsets) <= 2 || after.maxScroll - after.scrollLeft <= 2;
    expect(snapped, `snap offsets ${after.snapOffsets.join(', ')}`).toBe(true);
    await expect(prevButton(page)).not.toHaveAttribute('aria-disabled');

    for (let i = 0; i < 5 && (await prevButton(page).getAttribute('aria-disabled')) !== 'true'; i++) {
      await prevButton(page).click();
      await settledScroll(track);
    }
    await expect(prevButton(page)).toHaveAttribute('aria-disabled', 'true');
    expect(await settledScroll(track)).toBe(0);
  });
}

test('keyboard: Enter on Next until the end; the last card is visible and focus stays on Next', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/');
  await loaded(page);
  const track = list(page);
  await nextButton(page).focus();
  for (let i = 0; i < 5 && (await nextButton(page).getAttribute('aria-disabled')) !== 'true'; i++) {
    await page.keyboard.press('Enter');
    await settledScroll(track);
  }
  await expect(nextButton(page)).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await expect(nextButton(page)).toBeFocused();
  expect((await geometry(track)).lastEndRoom).toBeGreaterThanOrEqual(5);
});

test('reduced motion: Next scrolls without smooth behavior', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __scrolls: unknown[] }).__scrolls = calls;
    // Wrapped and re-called with the element as `this`.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element, arg?: boolean | ScrollIntoViewOptions) {
      calls.push(arg);
      original.call(this, arg);
    };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await loaded(page);
  await nextButton(page).click();
  expect(await page.evaluate(() => (window as unknown as { __scrolls: unknown[] }).__scrolls)).toEqual([
    { inline: 'start', block: 'nearest', behavior: 'auto' },
  ]);
  // Instant: already at rest on the first frame after the click.
  expect(await list(page).evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});
